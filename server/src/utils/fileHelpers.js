import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import writeFileAtomic from 'write-file-atomic';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

// ========================
// 支持的媒体扩展名常量
// ========================
export const SUPPORTED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
export const SUPPORTED_VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
export const SUPPORTED_AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.ogg'];
export const ALL_SUPPORTED_EXTS = [
  ...SUPPORTED_IMAGE_EXTS,
  ...SUPPORTED_VIDEO_EXTS,
  ...SUPPORTED_AUDIO_EXTS,
];

/**
 * 检测文件的媒体类型
 * @param {string} filename - 文件名
 * @returns {'image'|'video'|'audio'|null} 媒体类型
 */
export function detectMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (SUPPORTED_IMAGE_EXTS.includes(ext)) return 'image';
  if (SUPPORTED_VIDEO_EXTS.includes(ext)) return 'video';
  if (SUPPORTED_AUDIO_EXTS.includes(ext)) return 'audio';
  return null;
}

/**
 * 检查文件是否为支持的媒体格式
 * @param {string} filename - 文件名
 * @returns {boolean}
 */
export function isSupportedMedia(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALL_SUPPORTED_EXTS.includes(ext);
}

/**
 * 生成记录存储路径: records/YYYY/MM-DD-slug
 * @param {string} baseDir - 记录根目录
 * @param {Date} date - 日期
 * @param {string} title - 标题
 * @returns {string} 完整路径
 */
export function generateRecordPath(baseDir, date, title, uuid = '') {
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  let slug = slugify(title, { lower: true, strict: true });
  if (!slug) {
    // 允许中文目录名称，仅移除非法/不推荐路径字符并用下划线替代
    slug = title.replace(/[\/\s\?\\:\*\|"<>，。！]/g, '_').trim();
  }
  
  if (uuid) {
    const shortUuid = uuid.substring(0, 8);
    slug = slug ? `${slug}-${shortUuid}` : shortUuid;
  } else {
    slug = slug || 'untitled';
  }
  
  return path.join(baseDir, year, `${month}-${day}-${slug}`);
}

/**
 * 读取记录的 index.md 文件并解析 YAML front-matter
 * @param {string} indexPath - index.md 文件路径
 * @returns {Promise<{metadata: object, body: string}>}
 */
export async function readRecordMeta(indexPath) {
  const content = await fs.readFile(indexPath, 'utf-8');
  const { data, content: body } = matter(content);
  return { metadata: data, body: body.trim() };
}

/**
 * 写入记录的 index.md 文件（含 YAML front-matter）
 * 使用原子写入确保数据安全
 * @param {string} indexPath - index.md 文件路径
 * @param {object} metadata - YAML front-matter 数据
 * @param {string} body - Markdown 正文内容
 */
export async function writeRecordMeta(indexPath, metadata, body = '') {
  const content = matter.stringify(body, metadata);
  await writeFileAtomic(indexPath, content, 'utf-8');
}

/**
 * 创建新记录的初始元数据
 * @param {object} params
 * @param {string} params.title - 标题
 * @param {string} params.date - ISO 日期字符串
 * @param {string} params.mediaType - 媒体类型
 * @param {string} params.originalFilename - 原始文件名
 * @returns {object} 完整的元数据对象
 */
export function createRecordMetadata({ title, date, mediaType, originalFilename }) {
  return {
    uuid: uuidv4(),
    title: title || path.parse(originalFilename).name,
    date: date || new Date().toISOString(),
    media_type: mediaType,
    original_filename: originalFilename,
    status: 'draft',
    is_highlight: false,
    tags: [],
    summary: '',
    ai_metadata: {
      primary_category: '',
      confidence: 0,
      visual_tags: [],
      ocr_text_hint: '',
      source: '',
    },
    dominant_color: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
