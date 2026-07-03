import path from 'path';
import fs from 'fs/promises';
import chokidar from 'chokidar';
import exifr from 'exifr';
import {
  isSupportedMedia,
  detectMediaType,
  generateRecordPath,
  createRecordMetadata,
  writeRecordMeta,
} from './utils/fileHelpers.js';
import { classifyByRules, classifyWithOllama, classifyAudioContext } from './services/aiClassifier.js';
import { extractDominantColor } from './services/colorExtractor.js';
import { generateThumbnail } from './services/thumbnailGenerator.js';
import { transcribeAudio } from './services/whisperTranscriber.js';

/**
 * 提取音频转写的副标题/第一句描述
 */
function getAudioSubtitle(category, transcript) {
  if (!transcript) return 'skye的声音片段';
  
  // 提取书名号中的歌名/诗名
  const titleMatch = transcript.match(/《([^》]+)》/);
  if (titleMatch) {
    const title = titleMatch[1];
    return `skye ${category === '唱歌' ? '演唱' : '朗诵'}了《${title}》`;
  }
  
  // 提取第一句
  const firstSentence = transcript.split(/[。！？；,，]/)[0];
  if (firstSentence && firstSentence.length > 0) {
    return `skye说: “${firstSentence}...”`;
  }
  
  return `skye的声音片段`;
}

/**
 * 文件监视器
 * 监控 incoming 目录，自动处理新上传的媒体文件
 */
export class FileWatcher {
  /**
   * @param {object} options
   * @param {string} options.incomingDir - 待处理文件目录
   * @param {string} options.recordsDir - 记录存储目录
   * @param {import('./indexer.js').RecordIndexer} options.indexer - 记录索引器
   * @param {import('./services/taskQueue.js').TaskQueue} options.taskQueue - 任务队列
   * @param {Function} options.broadcast - WebSocket 广播函数
   * @param {boolean} options.aiAvailable - Ollama AI 服务是否可用
   */
  constructor({ incomingDir, recordsDir, indexer, taskQueue, broadcast, aiAvailable = false }) {
    this._incomingDir = incomingDir;
    this._recordsDir = recordsDir;
    this._indexer = indexer;
    this._taskQueue = taskQueue;
    this._broadcast = broadcast;
    this._watcher = null;
    this._aiAvailable = aiAvailable;
  }

  /**
   * 启动文件监视
   * 使用 awaitWriteFinish 等待文件写入完成后再处理
   */
  start() {
    console.log(`[Watcher] 开始监视目录: ${this._incomingDir}`);

    this._watcher = chokidar.watch(this._incomingDir, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this._watcher.on('add', (filePath) => {
      const filename = path.basename(filePath);

      // 忽略隐藏文件和非媒体文件
      if (filename.startsWith('.') || !isSupportedMedia(filename)) {
        console.log(`[Watcher] 跳过不支持的文件: ${filename}`);
        return;
      }

      console.log(`[Watcher] 检测到新文件: ${filename}`);

      // 加入任务队列串行处理
      this._taskQueue.add(() => this._processFile(filePath)).catch((error) => {
        console.error(`[Watcher] 处理文件失败: ${filename}`, error.message);
      });
    });

    this._watcher.on('error', (error) => {
      console.error('[Watcher] 监视器错误:', error.message);
    });
  }

  /**
   * 加载系统配置
   */
  async _loadConfig() {
    try {
      const configPath = path.join(this._recordsDir, '..', 'config.json');
      const raw = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { ai: { enabled: false }, whisper: { enabled: false } };
    }
  }

  /**
   * 处理单个新文件的完整流程
   * @param {string} filePath - 文件路径
   */
  async _processFile(filePath) {
    const filename = path.basename(filePath);
    const mediaType = detectMediaType(filename);

    console.log(`[Watcher] 开始处理文件: ${filename} (${mediaType})`);

    // 加载最新系统配置
    const config = await this._loadConfig();

    // 1. 尝试读取 EXIF 日期信息（仅图片）
    let dateStr;
    if (mediaType === 'image') {
      try {
        const exif = await exifr.parse(filePath, { pick: ['DateTimeOriginal', 'CreateDate'] });
        if (exif?.DateTimeOriginal) {
          dateStr = new Date(exif.DateTimeOriginal).toISOString();
        } else if (exif?.CreateDate) {
          dateStr = new Date(exif.CreateDate).toISOString();
        }
      } catch {
        // EXIF 读取失败，使用当前时间
      }
    }

    if (!dateStr) {
      dateStr = new Date().toISOString();
    }

    const date = new Date(dateStr);
    
    // 解析可能包含的 hex 编码自定义标题
    let title = path.parse(filename).name;
    let targetFilename = filename;
    
    const customTitleMatch = filename.match(/^(\d+)_title_([a-fA-F0-9]+)_(.+)$/);
    if (customTitleMatch) {
      try {
        const timestamp = customTitleMatch[1];
        const hexTitle = customTitleMatch[2];
        const originalName = customTitleMatch[3];
        title = Buffer.from(hexTitle, 'hex').toString('utf8');
        targetFilename = `${timestamp}_${originalName}`;
      } catch (err) {
        console.warn(`[Watcher] 无法解码自定义标题:`, err.message);
      }
    }

    // 2. 创建记录元数据
    const metadata = createRecordMetadata({
      title,
      date: dateStr,
      mediaType,
      originalFilename: targetFilename,
    });

    // 3. 创建记录目录并移动文件 (因为 AI 分类需要读取已移动的稳定文件路径)
    const recordDir = generateRecordPath(this._recordsDir, date, title, metadata.uuid);
    await fs.mkdir(recordDir, { recursive: true });

    const destPath = path.join(recordDir, targetFilename);
    await fs.rename(filePath, destPath);

    // 4. 使用 AI 智能分类或规则分类
    let classification;
    if (config.ai?.enabled && this._aiAvailable) {
      const categoryLabels = config.categories?.map(c => c.label) || [];
      classification = await classifyWithOllama(destPath, config.ai.ollama_url, config.ai.model, title, categoryLabels);
    } else {
      console.log(`[Watcher] AI ${config.ai?.enabled ? '不可用' : '未启用'}，使用规则分类: ${targetFilename}`);
      classification = classifyByRules(targetFilename, destPath);
    }

    metadata.ai_metadata = classification;
    metadata.summary = classification.summary || `自动归档了作品：${title}`;
    metadata.status = 'published';

    // 5. 图像专属处理：提取主色调 + 生成缩略图
    if (mediaType === 'image') {
      try {
        const color = await extractDominantColor(destPath);
        metadata.dominant_color = color;
        metadata.ai_metadata.visual_thumbnail_dominant_color = color;
      } catch (error) {
        console.warn(`[Watcher] 颜色提取失败: ${error.message}`);
        metadata.dominant_color = '#64748B';
      }

      try {
        await generateThumbnail(destPath, recordDir);
      } catch (error) {
        console.warn(`[Watcher] 缩略图生成失败: ${error.message}`);
      }
    }

    // 6. 音频专属处理：转写文本 + 音频子类别精细分类
    let markdownBody = `# ${metadata.title}\n\n自动归档于 ${new Date(dateStr).toLocaleString('zh-CN')}\n`;
    
    if (mediaType === 'audio') {
      try {
        // 调用离线转写 (支持真实/拟真)
        const transcript = await transcribeAudio(destPath, config);
        
        if (transcript) {
          console.log(`[Watcher] 音频转写成功: "${transcript}"`);
          markdownBody += `\n# 本地语音转写追加 (Audio-to-Text)\n[Whisper 转写 ${new Date().toLocaleString('zh-CN')}]: ${transcript}\n`;
          
          // 若启用了 AI，则用 AI 做音频精细细化分类 (唱歌 vs 朗诵)
          let refinedCategory = '舞台表现';
          if (config.ai?.enabled) {
            refinedCategory = await classifyAudioContext(transcript, config.ai.ollama_url, config.ai.model);
            console.log(`[Watcher] AI 音频精细分类结果: ${refinedCategory}`);
          } else {
            // 规则细化分类
            const keywords = ['小燕子', '穿花衣', '虫儿飞', '谢谢你', '歌', '唱', '词'];
            const hasKeyword = keywords.some(k => transcript.includes(k));
            refinedCategory = hasKeyword ? '唱歌' : '朗诵';
          }

          metadata.ai_metadata.primary_category = refinedCategory;
          
          // 提取成就感副标题
          const subtitle = getAudioSubtitle(refinedCategory, transcript);
          metadata.subtitle = subtitle;
          
          // 如果文件名是系统自动生成的录音文件，直接用副标题替换主标题，提供即时视觉成就感
          if (title.startsWith('recording_')) {
            metadata.title = subtitle;
          }
        }
      } catch (error) {
        console.warn(`[Watcher] 音频转写与精细分类失败: ${error.message}`);
      }
    }

    // 7. 写入 index.md 记录文件
    const indexPath = path.join(recordDir, 'index.md');
    await writeRecordMeta(indexPath, metadata, markdownBody);

    // 8. 更新内存索引
    await this._indexer.addFromFile(indexPath);

    // 9. 通过 WebSocket 广播新记录通知
    this._broadcast({
      type: 'NEW_RECORD',
      data: {
        uuid: metadata.uuid,
        title: metadata.title,
        media_type: mediaType,
        category: metadata.ai_metadata.primary_category,
        date: dateStr,
        dominant_color: metadata.dominant_color || '#64748B'
      },
    });

    console.log(`[Watcher] ✅ 文件处理完成: ${filename} → ${recordDir}`);
  }

  /**
   * 停止文件监视
   */
  async stop() {
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
      console.log('[Watcher] 文件监视已停止');
    }
  }
}
