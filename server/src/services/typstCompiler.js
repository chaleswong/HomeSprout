import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import sharp from 'sharp';

const execPromise = promisify(exec);

/**
 * 转义 Typst 中的特殊控制字符以防止编译失败
 * @param {string} text - 待处理文本
 */
function escapeTypst(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\') // 优先对反斜杠转义
    .replace(/([#$*_\(\)\[\]{}<>@=-~+/'"])/g, '\\$1') // 对所有 Typst 特殊控制字符转义
    .replace(/\n/g, ' \\\n'); // 将换行符转为 Typst 强制换行符
}

/**
 * 转换 WebP / HEIC 等不支持的格式为 JPEG 并返回临时文件路径
 * @param {string} mediaPath - 原始图片物理路径
 * @param {string} reportsDir - 临时文件存放目录
 * @param {Array<string>} tempFiles - 临时文件清理跟踪列表
 */
async function ensureCompatibleImage(mediaPath, reportsDir, tempFiles) {
  const ext = path.extname(mediaPath).toLowerCase();
  
  // Typst 0.12 不支持 WebP / HEIC / HEIF 等格式，必须在编译前转换为 .jpg
  const incompatibleExts = ['.webp', '.heic', '.heif'];
  
  if (incompatibleExts.includes(ext)) {
    const tempImageName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const tempImagePath = path.join(reportsDir, tempImageName);
    
    await sharp(mediaPath)
      .jpeg({ quality: 90 })
      .toFile(tempImagePath);
      
    tempFiles.push(tempImagePath);
    return tempImagePath;
  }
  
  return mediaPath;
}

/**
 * 将数据格式化为 Typst 语法，并调用本地 Typst 二进制编译为 PDF
 * @param {object} params
 * @param {string} params.reportId - 报告唯一 ID
 * @param {string} params.title - 报告标题
 * @param {string} params.generatedLetter - AI 自动生成的寄语/推荐信
 * @param {Array<object>} params.records - 选中的作品列表
 * @param {string} params.reportsDir - reports 存放物理目录
 * @param {string} params.projectRoot - 项目根目录 (用于定位 bin/typst)
 * @returns {Promise<string>} 生成的 PDF 物理路径
 */
export async function compileToPDF({ reportId, title, generatedLetter, records, reportsDir, projectRoot }) {
  const typstBin = path.join(projectRoot, 'server', 'bin', 'typst');
  const tempTypFile = path.join(reportsDir, `export_${reportId}.typ`);
  const outputPdfFile = path.join(reportsDir, `export_${reportId}.pdf`);
  const tempFiles = []; // 存放所有自动转换产生的临时图片路径

  // 1. 构建 Typst 源码内容
  // 注入 CJK 多款常用中文字体集，确保在不同 Linux 发行版及环境下均能正确渲染中文，无乱码
  let typstContent = `= ${escapeTypst(title)}

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
  header: align(right)[
    #text(8pt, fill: rgb("#94a3b8"))[🌱 HomeSprout Skye 的成长记录作品集]
  ],
  footer: [
    #align(center)[
      #text(8pt, fill: rgb("#94a3b8"))[第 #context counter(page).display() 页]
    ]
  ]
)

#set text(
  font: ("Liberation Sans", "Noto Sans CJK SC", "Source Han Sans SC", "Noto Sans CJK TC", "Microsoft YaHei", "SimSun", "WenQuanYi Micro Hei", "Droid Sans Fallback"),
  size: 10pt,
  lang: "zh"
)

#set par(leading: 0.7em, justify: true)

#align(center)[
  #v(0.5cm)
  #text(22pt, weight: "bold", fill: rgb("#1e3a8a"))[${escapeTypst(title)}]
  #v(0.3cm)
  #text(10pt, fill: rgb("#64748b"))[编译日期: ${new Date().toLocaleDateString('zh-CN')}]
  #v(0.8cm)
]

// 推荐信/成长寄语区块
#block(
  fill: rgb("#f8fafc"),
  inset: 15pt,
  radius: 8pt,
  stroke: 1pt + rgb("#e2e8f0"),
  width: 100%,
  breakable: false
)[
  #text(12pt, weight: "bold", fill: rgb("#0f172a"))[📝 寄语与成长评估]
  #v(0.3cm)
  #text(10pt)[${escapeTypst(generatedLetter)}]
]

#v(0.8cm)

#text(14pt, weight: "bold", fill: rgb("#0f172a"))[🎨 精选成长素材展示]
#v(0.4cm)
`;

  // 2. 循环写入每个作品素材
  for (const record of records) {
    const escTitle = escapeTypst(record.title);
    const escCategory = escapeTypst(record.category);
    const dateStr = new Date(record.date).toLocaleDateString('zh-CN');
    const escSummary = escapeTypst(record.summary || '');

    // 默认大类边框主色调
    const colorHex = record.dominant_color || '#64748b';

    typstContent += `
#block(
  width: 100%,
  stroke: (left: 4pt + rgb("${colorHex}")),
  inset: (left: 12pt),
  breakable: false,
)[
  #text(11pt, weight: "bold", fill: rgb("#0f172a"))[${escTitle}]
  #h(1fr)
  #text(8.5pt, fill: rgb("#64748b"))[${dateStr} | ${escCategory}]
  
  #v(0.2cm)
`;

    // 如果是图片，且文件存在，嵌入到 Typst 中
    if (record.media_type === 'image' && record.media_path) {
      // 检查物理文件是否存在
      try {
        await fs.access(record.media_path);
        // 确保图片格式兼容 (Typst 0.12 不支持 WebP)
        const compatiblePath = await ensureCompatibleImage(record.media_path, reportsDir, tempFiles);
        // 使用 forward slash 规范，并转义反斜杠
        const safePath = compatiblePath.replace(/\\/g, '/');
        typstContent += `
  #align(center)[
    #image("${safePath}", width: 75%)
  ]
  #v(0.2cm)
`;
      } catch (err) {
        console.warn(`[TypstCompiler] 图片处理/嵌入失败: ${record.media_path}, 错误: ${err.message}`);
      }
    }

    typstContent += `
  #text(9.5pt, fill: rgb("#334155"))[${escSummary}]
]
#v(0.4cm)
`;
  }

  // 3. 写入临时 `.typ` 文件
  await fs.writeFile(tempTypFile, typstContent, 'utf-8');

  // 4. 调用本地 typst 编译器编译为 pdf
  // --root / 参数至关重要，它允许 Typst CLI 访问系统任意位置 of the absolute path images
  const cmd = `"${typstBin}" compile "${tempTypFile}" "${outputPdfFile}" --root /`;
  console.log(`[TypstCompiler] 执行编译指令: ${cmd}`);

  try {
    await execPromise(cmd);
    console.log(`[TypstCompiler] 成功输出 PDF: ${outputPdfFile}`);
    return outputPdfFile;
  } catch (err) {
    console.error(`[TypstCompiler] 编译异常:`, err.message);
    throw new Error(`Typst 编译失败: ${err.message}`);
  } finally {
    // 异步清理临时 `.typ` 源码文件和转换生成的临时图片文件
    fs.unlink(tempTypFile).catch(() => {});
    for (const tempFile of tempFiles) {
      fs.unlink(tempFile).catch(() => {});
    }
  }
}
