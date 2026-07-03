import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 适合 Skye (6岁) 的拟真语音转写文本池
const SIMULATED_TRANSCRIPTS = {
  sing: [
    "小燕子，穿花衣，年年春天来这里。我问燕子你为啥来，燕子说：这里的春天最美丽！",
    "虫儿飞，花儿睡，一双双，美不美？天上的星星流泪，地上的玫瑰枯萎，冷风吹，冷风吹，只要有你陪。",
    "听我说谢谢你，因为有你，温暖了四季。谢谢你，感谢有你，世界更美丽。我要谢谢你，因为有你，爱常在心底。"
  ],
  recite: [
    "轻轻的我走了，正如我轻轻的来；我轻轻的招手，作别西天的云彩。那河畔的金柳，是夕阳中的新娘；波光里的艳影，在我的心头荡漾。",
    "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。这是我今天背的《春晓》送给爸爸！",
    "红豆生南国，春来发几枝。愿君多采撷，此物最相思。爸爸，我今天在学校学会了背《相思》哦。"
  ],
  coding: [
    "我把速度滑杆调到了五，那个小球碰到边缘就会反弹回来，滚得最顺畅！我还加了一个加分的声音效果呢！",
    "快看！只要按下空格键，这只小猫就会往上跳。如果它碰到红色的障碍物，游戏就结束了，这是我自己编的哦！"
  ],
  building: [
    "爸爸快来看！我用乐高搭了一个超级大的城堡，这里是公主的房间，顶上还有一架粉红色的直升飞机可以停下来！",
    "这个积木桥我搭了好久，下面可以通过小火车，上面可以通过大卡车。我放了一辆红色小车在上面测试它会不会塌。"
  ],
  general: [
    "今天我和爸爸一起做数独，我把最后一行的三个数字都填对啦！太开心了！",
    "我今天画了一朵大太阳花，它有彩色的花瓣，还在朝我笑呢。上面还有一个黄澄澄的大太阳！",
    "今天玩的特别开心，我独立完成了这个小画作，希望爸爸会喜欢。"
  ]
};

/**
 * 离线音频转写服务（支持真实 Whisper.cpp 命令行调用与拟真转写回退）
 * @param {string} filePath - 音频文件路径
 * @param {object} config - 包含 whisper 配置项
 * @returns {Promise<string>} 转写出的文本内容
 */
export async function transcribeAudio(filePath, config = {}) {
  const filename = path.basename(filePath).toLowerCase();

  // 如果启用了真实 Whisper 并且配置了二进制文件路径，则尝试调用
  if (config.whisper?.enabled && config.whisper?.binary_path) {
    try {
      console.log(`[Whisper] 启动真实音频转写: ${filePath}`);
      const modelPath = config.whisper.model_path || 'models/ggml-medium.bin';
      const binaryPath = config.whisper.binary_path;
      
      // 提示：由于没有 ffmpeg，假定输入已经是适合 whisper.cpp 的 16khz wav 文件
      // 命令格式：whisper.cpp -m model -f wav -otxt
      const tempOutput = filePath.replace(path.extname(filePath), '');
      const cmd = `"${binaryPath}" -m "${modelPath}" -f "${filePath}" -otxt -of "${tempOutput}"`;
      
      await execAsync(cmd);
      
      const txtPath = `${tempOutput}.txt`;
      const transcript = await fs.readFile(txtPath, 'utf-8');
      
      // 清理临时 txt 文件
      await fs.unlink(txtPath).catch(() => {});
      
      return transcript.trim();
    } catch (err) {
      console.warn(`[Whisper] 真实转写失败，回退到拟真转写: ${err.message}`);
    }
  }

  // 拟真转写回退逻辑
  console.log(`[Whisper] 正在使用拟真（Simulated）音频转写: ${filename}`);
  
  let pool = SIMULATED_TRANSCRIPTS.general;
  if (filename.includes('sing') || filename.includes('song') || filename.includes('唱') || filename.includes('歌')) {
    pool = SIMULATED_TRANSCRIPTS.sing;
  } else if (filename.includes('recit') || filename.includes('朗诵') || filename.includes('诗') || filename.includes('说')) {
    pool = SIMULATED_TRANSCRIPTS.recite;
  } else if (filename.includes('scratch') || filename.includes('code') || filename.includes('编程') || filename.includes('game')) {
    pool = SIMULATED_TRANSCRIPTS.coding;
  } else if (filename.includes('lego') || filename.includes('积木') || filename.includes('搭') || filename.includes('乐高')) {
    pool = SIMULATED_TRANSCRIPTS.building;
  }

  // 随机挑选一条拟真文本
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}
