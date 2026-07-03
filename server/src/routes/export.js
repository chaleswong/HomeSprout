import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { compileToPDF } from '../services/typstCompiler.js';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

// 动态且稳定地从当前模块文件物理路径向上追溯 3 层，定位项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// 存放局域网或手机端长连接后台 AI 编译任务的 Map
const exportJobs = new Map();

/**
 * 原生 http 模块实现的 JSON POST 请求辅助函数
 */
function postJSON(url, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 创建导出路由
 * @param {import('../indexer.js').RecordIndexer} indexer - 记录索引器
 * @returns {Router}
 */
export function createExportRouter(indexer) {
  const router = Router();

  // ========================
  // POST /preview - 预览导出内容，按分类分组
  // 需要管理员权限
  // ========================
  router.post('/preview', requireAdmin, (req, res) => {
    try {
      const { uuids } = req.body;

      if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        return res.status(400).json({ error: '请提供要导出的记录 UUID 列表' });
      }

      // 获取所有指定的记录
      const records = [];
      for (const uuid of uuids) {
        const record = indexer.get(uuid);
        if (record) {
          records.push(record);
        }
      }

      if (records.length === 0) {
        return res.status(404).json({ error: '未找到任何匹配的记录' });
      }

      // 按分类分组
      const grouped = {};
      for (const record of records) {
        const category = record.ai_metadata?.primary_category || '未知';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push({
          uuid: record.uuid,
          title: record.title,
          date: record.date,
          media_type: record.media_type,
          is_highlight: record.is_highlight,
          tags: record.tags,
          dominant_color: record.dominant_color,
        });
      }

      res.json({
        total: records.length,
        categories: grouped,
      });
    } catch (error) {
      console.error('[Export] 预览失败:', error.message);
      res.status(500).json({ error: '预览导出失败' });
    }
  });

  // ========================
  // POST /html - 生成可打印的 HTML 报告 (A4 Paged Media 版排版优化)
  // 需要管理员权限
  // ========================
  router.post('/html', requireAdmin, async (req, res) => {
    try {
      const { uuids, title = '🌱 HomeSprout 成长报告' } = req.body;

      if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        return res.status(400).json({ error: '请提供要导出的记录 UUID 列表' });
      }

      // 从本地 config.json 读取自定义分类配置，动态提取主色调及梯度
      const configPath = path.join(PROJECT_ROOT, 'data', 'config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      const categoryGradients = {};
      if (config.categories) {
        for (const cat of config.categories) {
          categoryGradients[cat.label] = cat.gradient || ['#64748B', '#94A3B8'];
        }
      }

      // 获取记录并按分类分组
      const grouped = {};
      for (const uuid of uuids) {
        const record = indexer.get(uuid);
        if (record) {
          const category = record.ai_metadata?.primary_category || '未知';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(record);
        }
      }

      // 生成 HTML
      const html = generatePrintableHTML(title, grouped, categoryGradients);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error('[Export] HTML 生成失败:', error.message);
      res.status(500).json({ error: 'HTML 导出失败' });
    }
  });

  // ========================
  // GET /status/:jobId - 查询后台 AI 编译任务状态
  // ========================
  router.get('/status/:jobId', requireAdmin, (req, res) => {
    const { jobId } = req.params;
    const job = exportJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: '任务不存在' });
    }
    res.json(job);
  });

  // ========================
  // POST /typst - 调用大模型并利用 Typst 引擎一键生成精美 A4 PDF 报告书 (异步任务版)
  // 需要管理员权限
  // ========================
  router.post('/typst', requireAdmin, async (req, res) => {
    try {
      const { uuids, title = 'skye 的成长档案', userPrompt } = req.body;

      if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        return res.status(400).json({ error: '请提供要导出的记录 UUID 列表' });
      }

      // 1. 读取系统配置
      const configPath = path.join(PROJECT_ROOT, 'data', 'config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      const reportsDir = path.join(PROJECT_ROOT, 'data', 'reports');

      // 确保 reports 目录存在
      await fs.mkdir(reportsDir, { recursive: true });

      // 2. 加载记录元数据
      const records = [];
      for (const uuid of uuids) {
        const record = indexer.get(uuid);
        if (record) {
          let mediaPath = '';
          if (record.media_type === 'image' && record.original_filename) {
            mediaPath = path.join(record._dir, record.original_filename);
          }
          records.push({
            uuid: record.uuid,
            title: record.title,
            date: record.date,
            category: record.ai_metadata?.primary_category || '未知',
            media_type: record.media_type,
            dominant_color: record.dominant_color,
            summary: record.summary || record.body || '无简介描述',
            media_path: mediaPath
          });
        }
      }

      if (records.length === 0) {
        return res.status(404).json({ error: '未找到选定的高光作品' });
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      // 初始化任务状态
      exportJobs.set(jobId, {
        status: 'generating',
        step: '正在通过 Ollama 生成报告寄语...',
        progress: 30,
        result: null,
        error: null
      });

      // 异步执行生成与编译任务
      (async () => {
        try {
          // 3. 构造大模型推荐信 prompt
          const recordsText = records.map((r, i) => {
            return `${i + 1}. [${r.category}] 《${r.title}》 (${new Date(r.date).toLocaleDateString('zh-CN')}) - 简介: ${r.summary}`;
          }).join('\n');

          const prompt = `你是一位深爱孩子的家长和专业指导老师。根据以下 Skye 的成长档案高光记录，为他撰写一篇结构化的“成长作品集总评/推荐信”。
这篇推荐信将被附在作品集的首页，用于 Skye 的升学 and 成长展示。

用户提供的写作导向/口吻要求: "${userPrompt || '温暖鼓励，肯定孩子的探索精神和多元智能发育'}"

以下是精选的成长作品素材:
${recordsText}

要求:
1. 用温暖、充满爱意和专业肯定的口吻（称呼 Skye 为 "skye" 或 "孩子"）。
2. 结合上面的素材，分析 Skye 的成长闪光点（如逻辑思维、艺术创造力、科学探究等）。
3. 给出温馨的指导建议与寄语。
4. 字数控制在 300-400 字之间。
5. 你必须直接返回 JSON 格式数据，结构定义为：
{
  "letter": "写给孩子的成长寄语与推荐信正文（直接以称呼开始，如 '亲爱的skye：'，不要带思考链或前导说明句）"
}`;

          console.log(`[Export Job ${jobId}] 正在通过 Ollama 生成报告寄语，模型: ${config.ai?.model || 'qwen3:4b'}`);
          
          const payload = {
            model: config.ai?.model || 'qwen3:4b',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            stream: false,
            format: 'json', // 强制以 JSON 格式输出，完美剥离思路链文本
            think: false, // 禁用思路链保证秒级生成
            options: {
              num_predict: 1000,
              temperature: 0.7
            }
          };

          let generatedLetter = '';
          try {
            const responseObj = await postJSON(`${config.ai.ollama_url}/api/chat`, payload, 300000);
            const contentText = responseObj?.message?.content || '{}';
            const parsed = JSON.parse(contentText);
            generatedLetter = parsed.letter || '';
          } catch (err) {
            console.warn(`[Export Job ${jobId}] Ollama 寄语生成或 JSON 解析解析失败，走本地默认兜底模版:`, err.message);
          }

          // 更新状态，开始编译
          exportJobs.set(jobId, {
            status: 'compiling',
            step: '寄语已生成，正在通过 Typst 排版排版引擎编译 A4 PDF...',
            progress: 70,
            result: null,
            error: null
          });

          // 4. 调用 Typst 编译器一键构建
          const reportId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const pdfPath = await compileToPDF({
            reportId,
            title,
            generatedLetter,
            records,
            reportsDir,
            projectRoot: PROJECT_ROOT
          });

          // 5. 保存一对应的 JSON 记录映射关系
          const reportMetadata = {
            id: reportId,
            title,
            date: new Date().toISOString(),
            uuids,
            user_prompt: userPrompt || '默认口吻（温暖鼓励，肯定探索精神）',
            generated_letter: generatedLetter,
            pdf_filename: `export_${reportId}.pdf`
          };
          
          const metaPath = path.join(reportsDir, `export_${reportId}.json`);
          await fs.writeFile(metaPath, JSON.stringify(reportMetadata, null, 2), 'utf-8');
          console.log(`[Export Job ${jobId}] 作品集导出关系配置已归档保存至: ${metaPath}`);

          // 更新状态为已完成
          exportJobs.set(jobId, {
            status: 'completed',
            step: '编译成功！正在为您自动下载 PDF 报告...',
            progress: 100,
            result: {
              pdfFilename: `export_${reportId}.pdf`,
              reportId,
              generatedLetter
            },
            error: null
          });
        } catch (err) {
          console.error(`[Export Job ${jobId}] 后台编译任务异常:`, err.message);
          exportJobs.set(jobId, {
            status: 'failed',
            step: '编译失败',
            progress: 100,
            result: null,
            error: err.message || '后台编译失败'
          });
        }
      })();

      // 立即返回 jobId
      res.json({
        success: true,
        jobId
      });
    } catch (error) {
      console.error('[Export] Typst 编译导出失败:', error.message);
      res.status(500).json({ error: error.message || 'Typst 导出失败' });
    }
  });

  // ========================
  // GET /download/:filename - 下载编译完成的 PDF 报告
  // ========================
  router.get('/download/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      
      // 正则校验过滤，防止路径穿越攻击
      if (!/^export_[a-zA-Z0-9_\-.]+\.pdf$/.test(filename)) {
        return res.status(400).json({ error: '非法文件名格式' });
      }

      const reportsDir = path.join(PROJECT_ROOT, 'data', 'reports');
      const filePath = path.join(reportsDir, filename);

      res.download(filePath, filename, (err) => {
        if (err) {
          console.error('[Export] 下载传输异常:', err.message);
          if (!res.headersSent) {
            res.status(404).json({ error: '您请求的报告书 PDF 不存在或已被清理' });
          }
        }
      });
    } catch (error) {
      console.error('[Export] 下载接口总线异常:', error.message);
      res.status(500).json({ error: '文件下载失败' });
    }
  });

  return router;
}

/**
 * 生成可打印的 HTML 报告
 * 使用 A4 纸张尺寸，图文并茂，包含简介与详细描述
 */
function generatePrintableHTML(title, grouped, categoryGradients) {
  const categorySections = Object.entries(grouped)
    .map(([category, records]) => {
      const gradient = categoryGradients[category] || ['#64748B', '#94A3B8'];

      const cards = records
        .map((r) => {
          const hasImage = r.media_type === 'image';
          const imageHTML = hasImage
            ? `<div class="card-image-container">
                 <img class="card-image" src="/api/records/${r.uuid}/media/thumb.webp" alt="${escapeHtml(r.title)}" />
               </div>`
            : '';

          const summaryHTML = r.summary
            ? `<div class="card-summary">
                 <strong>成长简介:</strong> ${escapeHtml(r.summary)}
               </div>`
            : '';

          const bodyHTML = r.body
            ? `<div class="card-body">
                 <strong>详细故事:</strong> ${escapeHtml(r.body)}
               </div>`
            : '';

          return `
            <div class="card" style="border-left: 5px solid ${gradient[0]}">
              <div class="card-header">
                <h3>${escapeHtml(r.title)}</h3>
                ${r.is_highlight ? '<span class="highlight-badge">⭐ 精选</span>' : ''}
              </div>
              <div class="card-meta">
                <span class="date">${new Date(r.date).toLocaleDateString('zh-CN')}</span>
                <span class="type">${r.media_type || ''}</span>
              </div>
              ${imageHTML}
              ${summaryHTML}
              ${bodyHTML}
            </div>
          `;
        })
        .join('');

      return `
        <section class="category-section">
          <div class="category-header" style="background: linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})">
            <h2>${escapeHtml(category)}</h2>
            <span class="count">${records.length} 条记录</span>
          </div>
          <div class="card-grid">
            ${cards}
          </div>
        </section>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

    @page {
      size: A4;
      margin: 1.8cm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Noto Sans SC', sans-serif;
      color: #334155;
      background: #ffffff;
      line-height: 1.6;
      padding: 0.5cm;
    }

    .report-header {
      text-align: center;
      padding: 2rem 0;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      border-radius: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-header h1 {
      font-size: 1.8rem;
      font-weight: 700;
    }

    .report-header .date {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-top: 0.5rem;
    }

    .category-section {
      margin-bottom: 2.5rem;
      break-inside: avoid;
    }

    .category-header {
      padding: 0.8rem 1.2rem;
      border-radius: 8px;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .category-header h2 {
      font-size: 1.2rem;
      font-weight: 500;
    }

    .category-header .count {
      font-size: 0.85rem;
      opacity: 0.9;
    }

    .card-grid {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1.2rem;
      border: 1px solid #e2e8f0;
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }

    .card-header h3 {
      font-size: 1.05rem;
      font-weight: 600;
      color: #0f172a;
      flex: 1;
    }

    .highlight-badge {
      font-size: 0.75rem;
      background: #fef3c7;
      color: #92400e;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      white-space: nowrap;
      margin-left: 0.5rem;
    }

    .card-meta {
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      gap: 1rem;
    }

    .card-image-container {
      text-align: center;
      max-height: 280px;
      overflow: hidden;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-image {
      max-width: 100%;
      max-height: 280px;
      object-fit: contain;
    }

    .card-summary {
      font-size: 0.85rem;
      color: #475569;
      font-style: italic;
      background: #f1f5f9;
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      border-left: 3px solid #cbd5e1;
    }

    .card-body {
      font-size: 0.9rem;
      color: #334155;
      text-align: justify;
    }

    @media print {
      body { padding: 0; }
      .card { border: 1px solid #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="date">生成日期: ${new Date().toLocaleDateString('zh-CN')}</div>
  </div>
  ${categorySections}
</body>
</html>`;
}

/**
 * HTML 实体转义
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
