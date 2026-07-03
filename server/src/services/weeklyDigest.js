import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { getISOWeek, getISOWeekYear, subDays } from 'date-fns';
import writeMarkdownMatter from 'write-file-atomic';
import { readRecordMeta } from '../utils/fileHelpers.js';

/**
 * 原生 http 模块实现的 JSON POST 请求辅助函数
 * 规避 Node.js native fetch (undici) 在本地请求时的 HeadersTimeout Bug
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
        'Connection': 'close' // 显式关闭 Keep-Alive，避免 HTTP 保持连接超时 bug
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
 * 递归获取目录下所有 index.md 文件路径
 */
async function getIndexFiles(dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const indexPath = path.join(fullPath, 'index.md');
        try {
          await fs.access(indexPath);
          files.push(indexPath);
        } catch {
          const subFiles = await getIndexFiles(fullPath);
          files.push(...subFiles);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[WeeklyDigest] 扫描目录错误 [${dir}]:`, err.message);
    }
  }
  return files;
}

/**
 * 生成周剪报核心逻辑
 * @param {string} recordsDir - 档案存储目录
 * @param {string} reportsDir - 报告存储目录
 * @param {object} config - 系统配置项
 * @returns {Promise<object>} 生成的周报数据
 */
export async function generateWeeklyDigest(recordsDir, reportsDir, config) {
  console.log('[WeeklyDigest] 开始扫描本周数据...');

  // 1. 获取最近 7 天内修改的作品记录
  const allIndexPaths = await getIndexFiles(recordsDir);
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  
  const weeklyRecords = [];
  let autoClassifiedSuccess = 0;
  for (const indexPath of allIndexPaths) {
    try {
      const { metadata } = await readRecordMeta(indexPath);
      const recordDate = new Date(metadata.date);
      
      if (recordDate >= sevenDaysAgo && recordDate <= now) {
        weeklyRecords.push(metadata);
        if (metadata.ai_metadata && metadata.ai_metadata.source === 'ollama-ai') {
          autoClassifiedSuccess++;
        }
      }
    } catch (err) {
      console.warn(`[WeeklyDigest] 读取记录失败: ${indexPath}`, err.message);
    }
  }

  // 2. 生成周标识符 (例如 "2026-W26")
  const weekNumber = getISOWeek(now);
  const weekYear = getISOWeekYear(now);
  const weekIdentifier = `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
  
  const reportFilename = `weekly_${weekYear}_w${String(weekNumber).padStart(2, '0')}.json`;
  const reportPath = path.join(reportsDir, reportFilename);

  console.log(`[WeeklyDigest] 本周新归档作品数: ${weeklyRecords.length}`);

  // 3. 构建本地 AI 总结提示词 (使用 Qwen 3-4B)
  const statsOverview = {
    total_captured_assets: weeklyRecords.length,
    auto_classified_success_rate: weeklyRecords.length > 0 
      ? Number((autoClassifiedSuccess / weeklyRecords.length).toFixed(2)) 
      : 1.0,
    records: weeklyRecords.map(r => ({
      title: r.title,
      category: r.ai_metadata?.primary_category || '未知',
      date: r.date,
      is_highlight: r.is_highlight,
      media_type: r.media_type
    }))
  };

  const systemPrompt = `# 任务
分析本周收录 of 儿童作品元数据，为爸爸生成一份高信息密度的技术流周度剪报。

# 必须返回的 JSON 格式（严禁包含任何 Markdown 标记符号或 \`\`\` 包裹）
{
  "week_identifier": "${weekIdentifier}",
  "data_density": {
    "total_captured_assets": ${statsOverview.total_captured_assets},
    "auto_classified_success_rate": ${statsOverview.auto_classified_success_rate}
  },
  "skye_focus_matrix": {
    "编程 (Scratch)": 0,
    "绘画 (艺术)": 0,
    "积木 (手工)": 0,
    "朗诵/唱歌": 0
  },
  "tech_dad_action_items": [
    "Skye本周连续多天上传了某类别作品，创造力较为活跃。",
    "监测到某某高光作品，已自动推荐加入作品集归档。"
  ]
}`;

  let digestResult;

  if (config.ai?.enabled) {
    try {
      console.log(`[WeeklyDigest] 正在通过 Ollama Qwen 3-4B 生成周报总结...`);
      const payload = {
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `以下是本周收录的作品列表统计，请帮助总结分析并输出指定的JSON报表: ${JSON.stringify(statsOverview)}`
          }
        ],
        stream: false,
        format: 'json',
        options: {
          num_predict: 400,
          temperature: 0.2
        }
      };

      // 300 秒超时，保证本地 CPU 有足够的推理生成时间（避开冷启动与思维模型生成耗时）
      const responseObj = await postJSON(`${config.ai.ollama_url}/api/chat`, payload, 300000);
      const responseText = responseObj?.message?.content || '';
      if (responseText) {
        digestResult = JSON.parse(responseText.trim());
        console.log(`[WeeklyDigest] AI 周报生成成功`);
      }
    } catch (err) {
      console.warn(`[WeeklyDigest] AI 生成失败，回退到规则分析统计: ${err.message}`);
    }
  }

  // 如果没有启用 AI 或 AI 生成失败，使用代码端统计作为兜底，生成结构一致的周报
  if (!digestResult) {
    console.log(`[WeeklyDigest] 使用本地规则统计生成周报...`);
    const skye_focus_matrix = {
      "编程 (Scratch)": 0,
      "绘画 (艺术)": 0,
      "积木 (手工)": 0,
      "朗诵/唱歌": 0
    };

    weeklyRecords.forEach(r => {
      const cat = r.ai_metadata?.primary_category;
      if (cat === '编程') skye_focus_matrix["编程 (Scratch)"]++;
      else if (cat === '绘画') skye_focus_matrix["绘画 (艺术)"]++;
      else if (cat === '积木') skye_focus_matrix["积木 (手工)"]++;
      else if (cat === '唱歌' || cat === '朗诵' || cat === '舞台表现') skye_focus_matrix["朗诵/唱歌"]++;
    });

    const tech_dad_action_items = [
      `本周共采集了 ${weeklyRecords.length} 件成长作品。`,
      weeklyRecords.some(r => r.is_highlight) 
        ? `本周有高光时刻被星标，可以直接在简历导出器中编译输出。` 
        : `本周还没有星标高光作品，可以在时光轴里浏览并给 Skye 打星推荐。`
    ];

    digestResult = {
      week_identifier: weekIdentifier,
      data_density: {
        total_captured_assets: weeklyRecords.length,
        auto_classified_success_rate: statsOverview.auto_classified_success_rate
      },
      skye_focus_matrix,
      tech_dad_action_items
    };
  }

  // 4. 原子地将结果写入 /data/reports/weekly_YYYY_wWW.json
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(digestResult, null, 2), 'utf-8');
  console.log(`[WeeklyDigest] ✅ 周剪报已保存至: ${reportPath}`);

  return digestResult;
}

/**
 * 启动每周定时任务 (每周日晚 23:00)
 */
export function startWeeklyDigestCron({ recordsDir, reportsDir, config }) {
  // 每小时检查一次，避免使用 node-cron 额外包
  const checkInterval = 60 * 60 * 1000; // 1小时
  
  const checkTime = () => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday
    const hours = now.getHours();
    
    // 如果是周日晚上 23:00 - 23:59 分
    if (day === 0 && hours === 23) {
      console.log('[WeeklyDigest] 触发定时扫描任务 (周日 23:00)...');
      generateWeeklyDigest(recordsDir, reportsDir, config).catch(err => {
        console.error('[WeeklyDigest] 定时任务失败:', err.message);
      });
    }
  };

  // 启动时延迟 1 分钟执行一次初检，之后每小时执行
  setTimeout(() => {
    checkTime();
    setInterval(checkTime, checkInterval);
  }, 60 * 1000);
}
