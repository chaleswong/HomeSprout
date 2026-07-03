import sharp from 'sharp';
import { Vibrant } from 'node-vibrant/node';

// 默认回退颜色（slate-500）
const FALLBACK_COLOR = '#64748B';

/**
 * 从图片中提取主色调
 * 先用 sharp 缩小图片以提升性能，再用 node-vibrant 提取调色板
 * @param {string} imagePath - 图片文件路径
 * @returns {Promise<string>} 十六进制颜色值
 */
export async function extractDominantColor(imagePath) {
  try {
    // 缩小图片到 100px 宽度以加速色彩提取
    const resizedBuffer = await sharp(imagePath)
      .resize(100)
      .toBuffer();

    const palette = await Vibrant.from(resizedBuffer).getPalette();

    // 优先使用 Vibrant 色，依次回退到其他色板
    const swatch =
      palette.Vibrant ||
      palette.DarkVibrant ||
      palette.LightVibrant ||
      palette.Muted ||
      palette.DarkMuted ||
      palette.LightMuted;

    return swatch ? swatch.hex : FALLBACK_COLOR;
  } catch (error) {
    console.warn(`[ColorExtractor] 提取颜色失败: ${imagePath}`, error.message);
    return FALLBACK_COLOR;
  }
}
