import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import { detectMediaType } from '../utils/fileHelpers.js';

// ========================
// 基于规则的分类正则模式 (Phase 1)
// ========================
const CATEGORY_RULES = [
  {
    category: '编程',
    patterns: [/scratch/i, /sb3/i, /编程/, /code/i, /program/i],
  },
  {
    category: '绘画',
    patterns: [/draw/i, /paint/i, /画/, /art/i, /绘/, /sketch/i, /涂/],
  },
  {
    category: '积木',
    patterns: [/lego/i, /积木/, /build/i, /block/i, /搭/, /乐高/],
  },
  {
    category: '数独',
    patterns: [/sudoku/i, /数独/, /math/i, /数学/],
  },
  {
    category: '舞台表现',
    patterns: [/sing/i, /song/i, /唱/, /歌/, /dance/i, /舞/, /表演/, /recit/i, /朗诵/, /演/],
  },
  {
    category: '阅读',
    patterns: [/read/i, /book/i, /书/, /阅/, /读/, /麦克狐/],
  },
];

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
 * 鲁棒性 JSON 解析器，能自动兼容及容忍 AI 生成的 Summary 文本中包含未转义的英文双引号的问题
 * @param {string} text - 原始文本
 * @returns {object} 解析后的对象
 */
function robustParseJSON(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    console.warn(`[AIClassifier] JSON.parse 失败，尝试正则提取字段:`, err.message);
    
    // 正则强行匹配提取各字段，容忍 unescaped double quotes inside summary string
    const categoryMatch = trimmed.match(/"primary_category"\s*:\s*"([^"]+)"/);
    const confidenceMatch = trimmed.match(/"confidence"\s*:\s*([0-9.]+)/);
    const summaryMatch = trimmed.match(/"summary"\s*:\s*"([\s\S]+?)"\s*\n?\s*}/) || 
                         trimmed.match(/"summary"\s*:\s*"([\s\S]+?)"\s*,/);
    const tagsMatch = trimmed.match(/"visual_tags"\s*:\s*\[([\s\S]*?)\]/);
    const ocrMatch = trimmed.match(/"ocr_text_hint"\s*:\s*"([^"]*)"/);

    if (!categoryMatch && !summaryMatch) {
      throw err; // 若连核心字段都正则不到，直接抛出原始 JSON 解析错误
    }

    let visual_tags = [];
    if (tagsMatch) {
      visual_tags = tagsMatch[1]
        .split(',')
        .map(t => t.replace(/["'\s]/g, '').trim())
        .filter(Boolean);
    }

    return {
      primary_category: categoryMatch ? categoryMatch[1].trim() : '未知',
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.9,
      visual_tags,
      ocr_text_hint: ocrMatch ? ocrMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].trim() : ''
    };
  }
}

/**
 * Phase 1: 基于文件名和路径的规则分类器
 * @param {string} filename - 文件名
 * @param {string} filePath - 文件完整路径
 * @returns {object} 分类结果
 */
export function classifyByRules(filename, filePath) {
  const searchStr = `${filename} ${filePath}`;

  // 遍历规则，找到第一个匹配的分类
  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(searchStr)) {
        return {
          primary_category: rule.category,
          confidence: 0.6,
          visual_tags: [],
          ocr_text_hint: '',
          source: 'rule-based',
        };
      }
    }
  }

  // 无规则匹配时，根据媒体类型给出默认分类
  const mediaType = detectMediaType(filename);
  let defaultCategory = '未知';

  if (mediaType === 'audio') {
    defaultCategory = '舞台表现';
  } else if (mediaType === 'image') {
    defaultCategory = '绘画';
  }

  return {
    primary_category: defaultCategory,
    confidence: 0.3,
    visual_tags: [],
    ocr_text_hint: '',
    source: 'default',
  };
}

/**
 * Phase 2: 使用 Ollama 进行 AI 分类
 * 支持多模态图像输入，若不支持则自动降级到文本上下文分类。失败时回退到规则分类。
 * @param {string} filePath - 文件完整路径
 * @param {string} ollamaUrl - Ollama 服务地址 (例如 http://localhost:11434)
 * @param {string} model - 使用的模型名称 (例如 qwen3:4b)
 * @param {string} customTitle - 用户填写的自定义作品名/标题
 * @returns {Promise<object>} 分类结果
 */
export async function classifyWithOllama(filePath, ollamaUrl, model, customTitle = '', categories = []) {
  const filename = path.basename(filePath);
  const mediaType = detectMediaType(filename);
  
  const categoryOptions = categories && categories.length > 0
    ? categories.join(' | ')
    : '积木 | 绘画 | 数独 | 编程 | 舞台表现 | 未知';

  const systemPrompt = `# 任务
分析输入的 skye 档案上下文或图像，判断其所属的兴趣大类，并提取关键视觉实体，同时根据作品名称和类型生成一段简短的孩子成长简介（简介应该用孩子和家长能看懂的温暖口吻，字数在50字以内）。

# 限制
1. 你的思考过程（thinking）必须非常简短，在 3 句话以内。
2. 思考后，必须立刻以 JSON 格式输出结果。
3. [重要] 任何在 JSON 字段值内部的引号，必须使用中文引号（如 “麦克狐” 或 《麦克狐》），绝对不能使用未转义的英文双引号。

# 必须返回的 JSON 格式（严禁包含任何 Markdown 标记符号或 \`\`\` 包裹）
{
  "primary_category": "${categoryOptions}",
  "confidence": 0.95,
  "visual_tags": ["标签1", "标签2"],
  "ocr_text_hint": "",
  "summary": "生成的孩子成长简介"
}`;

  // 智能识别模型是否支持多模态，避免非 Vision 模型盲目调用导致等待超时
  const lowerModel = model.toLowerCase();
  const isVisionModel = lowerModel.includes('vl') || 
                        lowerModel.includes('vision') || 
                        lowerModel.includes('llava') || 
                        lowerModel.includes('minicpm');

  try {
    let responseObj = null;
    
    // 如果是图像，且模型名称包含多模态关键字，则尝试作为 Vision 模型调用
    if (mediaType === 'image' && isVisionModel) {
      try {
        console.log(`[AIClassifier] 检测为多模态模型，尝试 Vision 图像输入: ${filename}，作品名: "${customTitle || filename}"`);
        const imageBuffer = await fs.readFile(filePath);
        const base64Image = imageBuffer.toString('base64');
        
        const payload = {
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `分析此作品图像以对其分类和概括。作品名字/标题: "${customTitle || filename}"，文件名: "${filename}"`,
              images: [base64Image]
            }
          ],
          stream: false,
          format: 'json',
          think: false,
          options: {
            num_predict: 250,
            temperature: 0.1
          }
        };

        responseObj = await postJSON(`${ollamaUrl}/api/chat`, payload, 20000);
        console.log(`[AIClassifier] 多模态分类响应成功`);
      } catch (err) {
        console.log(`[AIClassifier] 多模态分类失败，将退回纯文本上下文分析: ${err.message}`);
      }
    } else if (mediaType === 'image' && !isVisionModel) {
      console.log(`[AIClassifier] 当前模型 ${model} 不是 Vision 模型，跳过 Vision 输入直接使用文本上下文分类`);
    }

    // 进行纯文本元数据分析
    if (!responseObj) {
      console.log(`[AIClassifier] 使用纯文本上下文分类: ${filename}，作品名: "${customTitle || filename}"`);
      const textPrompt = `分析此档案记录的元数据，对其进行分类并生成简短简介。
作品名字/标题: "${customTitle || filename}"
文件名: "${filename}"
文件类型: "${mediaType}"
文件路径: "${filePath}"`;

      const payload = {
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: textPrompt
          }
        ],
        stream: false,
        format: 'json',
        think: false,
        options: {
          num_predict: 250,
          temperature: 0.1
        }
      };

      // 300 秒超时，防止本地 CPU 在大模型初次加载或推理过慢时发生超时
      responseObj = await postJSON(`${ollamaUrl}/api/chat`, payload, 300000);
      console.log(`[AIClassifier] 文本分类响应成功`);
    }

    // 解析 JSON 结果
    const responseText = responseObj?.message?.content || '';
    if (responseText) {
      const parsed = robustParseJSON(responseText);
      // 校验返回的分类在有效范围内
      const validCategories = categories && categories.length > 0
        ? categories
        : ['积木', '绘画', '数独', '编程', '舞台表现', '未知'];
        
      let primary_category = parsed.primary_category || '未知';
      if (!validCategories.includes(primary_category)) {
        // 模糊匹配，去除空格及引号的影响
        const matched = validCategories.find(c => c.trim() === primary_category.trim());
        primary_category = matched || '未知';
      }

      return {
        primary_category,
        confidence: Number(parsed.confidence) || 0.8,
        visual_tags: Array.isArray(parsed.visual_tags) ? parsed.visual_tags : [],
        ocr_text_hint: parsed.ocr_text_hint || '',
        summary: parsed.summary || `自动归档了作品：${customTitle || filename}`,
        source: 'ollama-ai'
      };
    }
  } catch (error) {
    console.warn(`[AIClassifier] Ollama 分类全链路失败或超时，退回规则分类: ${error.message}`);
  }

  // 兜底回退
  return {
    ...classifyByRules(filename, filePath),
    summary: `自动归档了作品：${customTitle || filename}`,
    source: 'fallback-rules'
  };
}

/**
 * 细化音频文件的子类别 (唱歌 vs 朗诵)
 * @param {string} transcript - 语音转写文本
 * @param {string} ollamaUrl - Ollama 服务地址
 * @param {string} model - 模型名称
 * @returns {Promise<string>} '唱歌' | '朗诵'
 */
export async function classifyAudioContext(transcript, ollamaUrl, model) {
  if (!transcript) return '舞台表现';

  try {
    const prompt = `分析以下儿童录音的转写文本，判断其行为属于「唱歌」还是「朗诵」。
唱歌的特征：多重复句、歌词结构、排比叠句。
朗诵的特征：散文、故事叙述、朗读课文、古诗词。

转写文本内容: "${transcript}"

你必须严格返回以下 JSON 格式（严禁包含任何 Markdown 标记符号或 \`\`\` 包裹）：
{
  "category": "唱歌 | 朗诵",
  "confidence": 0.9
}`;

    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      format: 'json',
      think: false,
      options: {
        num_predict: 150,
        temperature: 0.1
      }
    };

    // 25 秒超时
    const responseObj = await postJSON(`${ollamaUrl}/api/chat`, payload, 25000);
    const responseText = responseObj?.message?.content || '';
    if (responseText) {
      const parsed = JSON.parse(responseText.trim());
      const category = parsed.category || '朗诵';
      
      if (category.includes('唱') || category.toLowerCase().includes('sing')) {
        return '唱歌';
      }
      return '朗诵';
    }
  } catch (err) {
    console.warn(`[AIClassifier] 音频细化分类失败: ${err.message}`);
  }

  // 兜底判定
  const keywords = ['小燕子', '穿花衣', '虫儿飞', '听我说', '歌', '唱', '词'];
  const hasKeyword = keywords.some(k => transcript.includes(k));
  return hasKeyword ? '唱歌' : '朗诵';
}
