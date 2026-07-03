import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import exifr from 'exifr';
import {
  isSupportedMedia,
  detectMediaType,
  generateRecordPath,
  createRecordMetadata,
  writeRecordMeta,
} from '../utils/fileHelpers.js';
import { classifyByRules, classifyWithOllama } from '../services/aiClassifier.js';
import { extractDominantColor } from '../services/colorExtractor.js';
import { generateThumbnail } from '../services/thumbnailGenerator.js';

/**
 * 创建上传路由
 * @param {string} incomingDir - 待处理文件存放目录
 * @param {import('../indexer.js').RecordIndexer} indexer - 记录索引器
 * @param {object} config - 全局配置
 * @param {Function} broadcast - WebSocket 广播函数
 * @returns {Router}
 */
export function createUploadRouter(incomingDir, indexer, config, broadcast) {
  const router = Router();
  const tempUploadDir = path.join(incomingDir, '..', 'temp_upload');

  // 配置 单文件上传 multer 存储：文件名使用时间戳前缀确保唯一性
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, incomingDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const title = req.body.title || '';
      if (title) {
        const hexTitle = Buffer.from(title.trim()).toString('hex');
        cb(null, `${timestamp}_title_${hexTitle}_${originalName}`);
      } else {
        cb(null, `${timestamp}_${originalName}`);
      }
    },
  });

  // 配置 批量多图上传 multer 存储：保存至 temp_upload，防止 watcher 抢跑单独解析
  const batchStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      await fs.mkdir(tempUploadDir, { recursive: true });
      cb(null, tempUploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, `${timestamp}_${originalName}`);
    },
  });

  // 文件过滤器：只接受支持的媒体格式
  const fileFilter = (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (isSupportedMedia(originalName)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${path.extname(originalName)}`), false);
    }
  };

  const uploadSingle = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB 限制
    },
  });

  const uploadBatch = multer({
    storage: batchStorage,
    fileFilter,
    limits: {
      fileSize: 500 * 1024 * 1024,
    },
  });

  // ========================
  // POST / - 单文件上传
  // ========================
  router.post('/', uploadSingle.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '未提供文件或文件格式不支持' });
    }

    res.status(201).json({
      message: '文件上传成功',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
      },
    });
  });

  // ========================
  // POST /batch - 批量上传（多图并为一个作品包）
  // ========================
  router.post('/batch', uploadBatch.array('files', 20), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: '未提供文件或文件格式不支持' });
      }

      const title = req.body.title || '我的多图作品';
      const files = req.files;

      // 1. 确定整体媒体大类及日期 (以第一张为封面基准)
      const firstFile = files[0];
      const mediaType = detectMediaType(firstFile.filename);
      let dateStr = new Date().toISOString();

      if (mediaType === 'image') {
        try {
          const exif = await exifr.parse(firstFile.path, { pick: ['DateTimeOriginal', 'CreateDate'] });
          if (exif?.DateTimeOriginal) {
            dateStr = new Date(exif.DateTimeOriginal).toISOString();
          } else if (exif?.CreateDate) {
            dateStr = new Date(exif.CreateDate).toISOString();
          }
        } catch (err) {
          // EXIF 读取失败，忽略
        }
      }

      const date = new Date(dateStr);
      
      // 创建记录元数据
      const metadata = createRecordMetadata({
        title,
        date: dateStr,
        mediaType,
        originalFilename: firstFile.filename,
      });

      const recordsDir = indexer._recordsDir;
      const recordDir = generateRecordPath(recordsDir, date, title, metadata.uuid);
      await fs.mkdir(recordDir, { recursive: true });

      // 2. 将所有上传文件迁移至作品物理归档目录
      for (const file of files) {
        const destPath = path.join(recordDir, file.filename);
        await fs.rename(file.path, destPath);
      }

      const coverImagePath = path.join(recordDir, firstFile.filename);

      // 3. AI 智能分类或规则分类 (基于封面图)
      let classification;
      if (config.ai?.enabled) {
        const categoryLabels = config.categories?.map(c => c.label) || [];
        classification = await classifyWithOllama(coverImagePath, config.ai.ollama_url, config.ai.model, title, categoryLabels);
      } else {
        classification = classifyByRules(firstFile.filename, coverImagePath);
      }

      metadata.ai_metadata = classification;
      metadata.summary = classification.summary || `自动归档了多图作品：${title}`;
      metadata.status = 'published';

      // 4. 图片专属处理：提取主色调 + 生成缩略图
      if (mediaType === 'image') {
        try {
          const color = await extractDominantColor(coverImagePath);
          metadata.dominant_color = color;
          metadata.ai_metadata.visual_thumbnail_dominant_color = color;
        } catch (error) {
          console.warn(`[BatchUpload] 颜色提取失败: ${error.message}`);
          metadata.dominant_color = '#64748B';
        }

        try {
          await generateThumbnail(coverImagePath, recordDir);
        } catch (error) {
          console.warn(`[BatchUpload] 缩略图生成失败: ${error.message}`);
        }
      }

      // 5. 生成 Markdown 主体内容
      let markdownBody = `# ${metadata.title}\n\n该作品由 ${files.length} 张图片组成，自动归档于 ${new Date(dateStr).toLocaleString('zh-CN')}\n`;

      // 6. 写入 index.md 元数据
      const indexPath = path.join(recordDir, 'index.md');
      await writeRecordMeta(indexPath, metadata, markdownBody);

      // 7. 将新纪录注册进内存索引
      await indexer.addFromFile(indexPath);

      // 8. 实时 WebSocket 广播通知所有终端
      broadcast({
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

      res.status(201).json({
        message: `成功归档 ${files.length} 个作品附件为单个成长树记录`,
        uuid: metadata.uuid,
        title: metadata.title,
      });
    } catch (error) {
      console.error('[Upload] 批量归档处理失败:', error);
      res.status(500).json({ error: error.message || '批量上传归档失败' });
    }
  });

  // ========================
  // Multer 错误处理中间件
  // ========================
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件大小超过 500MB 限制' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: '批量上传最多 20 个文件' });
      }
      return res.status(400).json({ error: `上传错误: ${err.message}` });
    }

    if (err) {
      return res.status(400).json({ error: err.message });
    }

    next();
  });

  return router;
}
