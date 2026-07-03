import path from 'path';
import sharp from 'sharp';
import fs from 'fs/promises';

/**
 * 为图片生成缩略图
 * 最大尺寸 400px（等比缩放，fit inside），输出为 WebP 格式
 * @param {string} imagePath - 原始图片路径
 * @param {string} outputDir - 缩略图输出目录
 * @returns {Promise<string>} 缩略图文件路径
 */
export async function generateThumbnail(imagePath, outputDir) {
  const thumbFilename = 'thumb.webp';
  const outputPath = path.join(outputDir, thumbFilename);

  try {
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });

    await sharp(imagePath)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error(`[ThumbnailGenerator] 生成缩略图失败: ${imagePath}`, error.message);
    throw error;
  }
}
