import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import http, { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { RecordIndexer } from './indexer.js';
import { TaskQueue } from './services/taskQueue.js';
import { FileWatcher } from './watcher.js';
import { createAuthMiddleware, requireAdmin } from './middleware/auth.js';
import { createRecordsRouter } from './routes/records.js';
import { createUploadRouter } from './routes/upload.js';
import { createExportRouter } from './routes/export.js';
import { createStatsRouter } from './routes/stats.js';
import { startWeeklyDigestCron } from './services/weeklyDigest.js';


// ========================
// 路径解析
// ========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

// ========================
// 加载配置
// ========================
const configPath = path.join(PROJECT_ROOT, 'data', 'config.json');
let config;

try {
  const raw = await fs.readFile(configPath, 'utf-8');
  config = JSON.parse(raw);
} catch (error) {
  console.error('❌ 无法加载配置文件:', configPath, error.message);
  process.exit(1);
}

// 解析各数据目录路径（相对于项目根目录）
const resolvePath = (p) => path.resolve(PROJECT_ROOT, p);
const incomingDir = resolvePath(config.paths.incoming);
const recordsDir = resolvePath(config.paths.records);
const draftsDir = resolvePath(config.paths.drafts);
const reportsDir = resolvePath(config.paths.reports);
const trashDir = resolvePath(config.paths.trash);
const tempUploadDir = path.join(PROJECT_ROOT, 'data', 'temp_upload');

// ========================
// 确保所有数据目录存在
// ========================
await Promise.all(
  [incomingDir, recordsDir, draftsDir, reportsDir, trashDir, tempUploadDir].map((dir) =>
    fs.mkdir(dir, { recursive: true })
  )
);

// ========================
// 初始化核心服务
// ========================
const indexer = new RecordIndexer();
const taskQueue = new TaskQueue(1);

// ========================
// 创建 Express 应用和 HTTP 服务器
// ========================
const app = express();
const server = createServer(app);

// ========================
// WebSocket 服务
// ========================
const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] 客户端已连接 (在线: ${wsClients.size})`);

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] 客户端已断开 (在线: ${wsClients.size})`);
  });

  ws.on('error', (error) => {
    console.error('[WS] 连接错误:', error.message);
    wsClients.delete(ws);
  });
});

/**
 * 向所有连接的 WebSocket 客户端广播消息
 * @param {object} message - 要广播的消息对象
 */
function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      client.send(data);
    }
  }
}

// ========================
// 中间件
// ========================
app.use(cors());
app.use(express.json());
app.use(createAuthMiddleware(configPath));

// ========================
// API 路由
// ========================
app.use('/api/records', createRecordsRouter(indexer));
app.use('/api/upload', createUploadRouter(incomingDir, indexer, config, broadcast));
app.use('/api/export', createExportRouter(indexer));
app.use('/api/stats', createStatsRouter(indexer, recordsDir, reportsDir, config));


// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    records: indexer.getStats().total,
    queue: {
      pending: taskQueue.pending,
      active: taskQueue.active,
    },
    ai: {
      enabled: config.ai?.enabled || false,
      available: aiAvailable,
      model: config.ai?.model || 'N/A',
    },
  });
});

// 获取 AI 状态
app.get('/api/ai/status', (req, res) => {
  res.json({
    enabled: config.ai?.enabled || false,
    available: aiAvailable,
    model: config.ai?.model || 'N/A',
    ollama_url: config.ai?.ollama_url || 'N/A',
  });
});

// 获取分类配置
app.get('/api/config/categories', (req, res) => {
  res.json(config.categories || []);
});

// 添加自定义分类
app.post('/api/config/categories', requireAdmin, async (req, res) => {
  try {
    const { id, label, icon, gradient, dimension } = req.body;
    if (!label) {
      return res.status(400).json({ error: '分类名称不能为空' });
    }

    // 检查是否已存在
    const exists = (config.categories || []).some(
      (c) => c.label === label || (id && c.id === id)
    );
    if (exists) {
      return res.status(400).json({ error: '该分类名称或ID已存在' });
    }

    const newCategory = {
      id: id || `custom-${Date.now()}`,
      label,
      icon: icon || '📁',
      gradient: gradient || ['#64748B', '#94A3B8'],
      ...(dimension && dimension.trim() ? { dimension: dimension.trim() } : {}),
    };

    if (!config.categories) {
      config.categories = [];
    }
    config.categories.push(newCategory);

    // 写入文件并热更新
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[Config] 成功添加自定义分类: ${label} (${newCategory.id})`);

    res.json({ message: '添加分类成功', category: newCategory });
  } catch (error) {
    console.error('[Config] 添加分类失败:', error.message);
    res.status(500).json({ error: '添加分类失败' });
  }
});

// 更新分类 dimension（雷达图轴标签名称）
app.patch('/api/config/category/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { dimension } = req.body;

    const cat = (config.categories || []).find((c) => c.id === id);
    if (!cat) {
      return res.status(404).json({ error: '分类不存在' });
    }

    if (dimension !== undefined) {
      cat.dimension = dimension.trim() || undefined;
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[Config] 更新分类 ${id} 的成长维度: ${dimension}`);
    res.json({ message: '更新成功', category: cat });
  } catch (error) {
    console.error('[Config] 更新分类维度失败:', error.message);
    res.status(500).json({ error: '更新失败' });
  }
});

// ========================
// 主题模式配置接口
// ========================
app.get('/api/config/theme', (req, res) => {
  res.json({ theme: config.theme || 'dark' });
});

app.post('/api/config/theme', requireAdmin, async (req, res) => {
  try {
    const { theme } = req.body;
    if (theme !== 'dark' && theme !== 'light') {
      return res.status(400).json({ error: '无效的主题样式' });
    }

    config.theme = theme;

    // 写入文件并热更新
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[Config] 全局主题显示模式已更改为: ${theme}`);

    // 利用 WebSocket 全体广播通知
    broadcast({ type: 'THEME_UPDATED', theme });

    res.json({ message: '全局主题配置已保存', theme });
  } catch (error) {
    console.error('[Config] 更新主题配置失败:', error.message);
    res.status(500).json({ error: '主题更新失败' });
  }
});

// 诊断 Ollama 调用
app.get('/api/test-ollama', async (req, res) => {
  try {
    const { classifyWithOllama } = await import('./services/aiClassifier.js');
    console.log('[Diagnostic] 启动 classifyWithOllama 测试...');
    const start = Date.now();
    const result = await classifyWithOllama(
      '/home/bark/workspace/HomeSprout/data/records/2026/07-01-skyelegocastle/skye_lego_castle.jpg',
      config.ai.ollama_url,
      config.ai.model,
      '',
      config.categories?.map(c => c.label) || []
    );
    res.json({
      success: true,
      time: Date.now() - start,
      result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// ========================
// 静态文件服务（客户端 SPA）
// ========================
const clientDistDir = path.join(PROJECT_ROOT, 'client', 'dist');
try {
  await fs.access(clientDistDir);
  app.use(express.static(clientDistDir));

  // SPA 回退：所有未匹配的 GET 请求返回 index.html
  app.get(/.*/, (req, res) => {
    // 不对 API 路由做 SPA 回退
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API 端点不存在' });
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} catch {
  // 客户端构建产物不存在，跳过静态文件服务
  console.log('[Server] 未检测到客户端构建产物，跳过静态文件服务');

  app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API 端点不存在' });
    }
    res.status(200).send('🌱 HomeSprout Server is running. Client not built yet.');
  });
}

let aiAvailable = false;

async function checkOllamaAvailability(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: '/api/tags',
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.end();
    } catch {
      resolve(false);
    }
  });
}

// ========================
// 启动服务
// ========================
const PORT = config.server?.port || 3001;
const HOST = config.server?.host || '0.0.0.0';

async function start() {
  // 检测 Ollama 可用性
  if (config.ai?.enabled) {
    aiAvailable = await checkOllamaAvailability(config.ai.ollama_url);
    if (aiAvailable) {
      console.log(`[AI] Ollama 服务可用，将使用 ${config.ai.model} 进行智能分类`);
      preloadOllamaModel(config.ai.ollama_url, config.ai.model);
    } else {
      console.warn(`[AI] Ollama 服务不可用，将使用规则分类代替`);
    }
  }

  // 初始化索引器
  await indexer.init(recordsDir);

  // 创建文件监视器（传入 AI 可用性状态）
  const watcher = new FileWatcher({
    incomingDir,
    recordsDir,
    indexer,
    taskQueue,
    broadcast,
    aiAvailable,
  });

  // 启动文件监视器
  watcher.start();

  // 启动周剪报定时任务
  startWeeklyDigestCron({ recordsDir, reportsDir, config });


  // 启动 HTTP 服务器
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  🌱 ╔═══════════════════════════════════════╗');
    console.log('  🌱 ║                                       ║');
    console.log('  🌱 ║       HomeSprout Server v1.0.0        ║');
    console.log('  🌱 ║       孩子的成长记录管理系统           ║');
    console.log('  🌱 ║                                       ║');
    console.log('  🌱 ╠═══════════════════════════════════════╣');
    console.log(`  🌱 ║  🌐 HTTP:  http://${HOST}:${PORT}        ║`);
    console.log(`  🌱 ║  📡 WS:    ws://${HOST}:${PORT}          ║`);
    console.log(`  🌱 ║  📂 监控:  ${incomingDir}`);
    console.log(`  🌱 ║  📊 记录:  ${indexer.getStats().total} 条已索引`);
    console.log(`  🌱 ║  🤖 AI:    ${aiAvailable ? '✓ 可用' : '✗ 不可用'}`);
    console.log('  🌱 ║                                       ║');
    console.log('  🌱 ╚═══════════════════════════════════════╝');
    console.log('');
  });
}

// ========================
// 优雅关闭
// ========================
async function shutdown(signal) {
  console.log(`\n[Server] 收到 ${signal} 信号，正在优雅关闭...`);

  // 停止文件监视
  await watcher.stop();

  // 关闭 WebSocket 连接
  for (const client of wsClients) {
    client.close();
  }
  wsClients.clear();

  // 关闭 HTTP 服务器
  server.close(() => {
    console.log('[Server] 🌱 HomeSprout 已安全关闭');
    process.exit(0);
  });

  // 超时强制退出
  setTimeout(() => {
    console.error('[Server] 强制关闭（超时）');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/**
 * 后台预加载 Ollama 模型，规避冷启动时的延迟和超时
 */
function preloadOllamaModel(url, model) {
  try {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: 'Warm up' }],
      stream: false
    });
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close'
      }
    };
    
    console.log(`[AIClassifier] 发送预加载请求至 Ollama 以初始化模型: ${model}...`);
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        console.log(`[AIClassifier] Ollama 模型 ${model} 预加载响应完成，状态码: ${res.statusCode}`);
      });
    });
    
    req.setTimeout(60000, () => {
      req.destroy(new Error('Preload timeout'));
    });
    
    req.on('error', (err) => {
      console.warn(`[AIClassifier] Ollama 模型预加载失败: ${err.message}`);
    });
    
    req.write(postData);
    req.end();
  } catch (err) {
    console.warn(`[AIClassifier] 设置预加载模型遇到异常:`, err.message);
  }
}

// 启动！
start().catch((error) => {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
});
