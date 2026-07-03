import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { readRecordMeta, writeRecordMeta } from '../utils/fileHelpers.js';
import { requireAdmin } from '../middleware/auth.js';
import { getGraphData } from '../services/graphService.js';

/**
 * 创建记录路由
 * @param {import('../indexer.js').RecordIndexer} indexer - 记录索引器
 * @returns {Router}
 */
export function createRecordsRouter(indexer) {
  const router = Router();

  // ========================
  // GET / - 获取记录列表（支持查询过滤）
  // ========================
  router.get('/', (req, res) => {
    try {
      const { category, status, is_highlight, year, month, search, page, limit } = req.query;
      const result = indexer.query({
        category,
        status,
        is_highlight,
        year,
        month,
        search,
        page,
        limit,
      });
      res.json(result);
    } catch (error) {
      console.error('[Records] 查询失败:', error.message);
      res.status(500).json({ error: '查询记录失败' });
    }
  });

  // ========================
  // GET /graph - 获取图谱拓扑数据
  // ========================
  router.get('/graph', async (req, res) => {
    try {
      const recordsDir = indexer._recordsDir;
      const graphData = await getGraphData(indexer, recordsDir);
      res.json(graphData);
    } catch (error) {
      console.error('[Records] 获取图谱失败:', error.message);
      res.status(500).json({ error: '获取图谱失败' });
    }
  });

  // ========================
  // GET /:uuid - 获取单条记录
  // ========================
  router.get('/:uuid', (req, res) => {
    const record = indexer.get(req.params.uuid);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  });

  // ========================
  // GET /:uuid/files - 列出记录目录下的媒体文件
  // ========================
  router.get('/:uuid/files', async (req, res) => {
    try {
      const record = indexer.get(req.params.uuid);
      if (!record) {
        return res.status(404).json({ error: '记录不存在' });
      }

      const recordDir = record._dir;
      const entries = await fs.readdir(recordDir);

      // 过滤掉 index.md，返回其他文件列表
      const files = entries.filter((f) => f !== 'index.md');
      res.json({ files, dir: recordDir });
    } catch (error) {
      console.error('[Records] 获取文件列表失败:', error.message);
      res.status(500).json({ error: '获取文件列表失败' });
    }
  });

  // ========================
  // GET /:uuid/media/:filename - 提供媒体文件下载/预览
  // ========================
  router.get('/:uuid/media/:filename', (req, res) => {
    const record = indexer.get(req.params.uuid);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(403).json({ error: '非法文件名' });
    }

    const filePath = path.join(record._dir, filename);
    const realRecordDir = path.resolve(record._dir);
    const realFilePath = path.resolve(filePath);

    if (!realFilePath.startsWith(realRecordDir)) {
      return res.status(403).json({ error: '非法文件路径' });
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('[Records] 文件发送失败:', err.message);
        if (!res.headersSent) {
          res.status(404).json({ error: '文件不存在' });
        }
      }
    });
  });

  // ========================
  // PATCH /:uuid - 更新记录
  // 可更新字段: title, tags, status, ai_metadata
  // is_highlight 需要管理员权限
  // ========================
  router.patch('/:uuid', async (req, res) => {
    try {
      const record = indexer.get(req.params.uuid);
      if (!record) {
        return res.status(404).json({ error: '记录不存在' });
      }

      const updates = {};
      const { title, is_highlight, tags, status, ai_metadata, summary } = req.body;

      // 更新标题
      if (title !== undefined) {
        updates.title = title;
      }

      // 高亮标记需要管理员权限
      if (is_highlight !== undefined) {
        if (req.userRole !== 'admin') {
          return res.status(403).json({ error: '设置高亮需要管理员权限' });
        }
        updates.is_highlight = is_highlight;
      }

      // 更新标签
      if (tags !== undefined) {
        updates.tags = tags;
      }

      // 更新状态
      if (status !== undefined) {
        updates.status = status;
      }

      // 更新简介
      if (summary !== undefined) {
        updates.summary = summary;
      }

      // 更新 AI 元数据
      if (ai_metadata !== undefined) {
        updates.ai_metadata = { ...record.ai_metadata, ...ai_metadata };
      }

      // 更新内存索引
      const updatedRecord = indexer.update(req.params.uuid, updates);

      // 同步更新 index.md 文件
      const indexPath = record._indexPath;
      const { body } = await readRecordMeta(indexPath);

      // 提取不含内部字段的元数据用于写入文件
      const metaForFile = { ...updatedRecord };
      delete metaForFile.body;
      delete metaForFile._indexPath;
      delete metaForFile._dir;

      await writeRecordMeta(indexPath, metaForFile, body);

      res.json(updatedRecord);
    } catch (error) {
      console.error('[Records] 更新失败:', error.message);
      res.status(500).json({ error: '更新记录失败' });
    }
  });

  // ========================
  // DELETE /:uuid - 软删除记录（移到回收站）
  // 需要管理员权限
  // ========================
  router.delete('/:uuid', requireAdmin, async (req, res) => {
    try {
      const record = indexer.get(req.params.uuid);
      if (!record) {
        return res.status(404).json({ error: '记录不存在' });
      }

      const recordDir = record._dir;
      const trashDir = path.join(path.dirname(indexer._recordsDir || recordDir), 'trash');
      await fs.mkdir(trashDir, { recursive: true });

      // 移动到回收站，使用 uuid 作为目录名避免冲突
      const trashDest = path.join(trashDir, `${record.uuid}_${Date.now()}`);
      await fs.rename(recordDir, trashDest);

      // 从内存索引中删除
      indexer.remove(req.params.uuid);

      res.json({ message: '记录已移至回收站', uuid: req.params.uuid });
    } catch (error) {
      console.error('[Records] 删除失败:', error.message);
      res.status(500).json({ error: '删除记录失败' });
    }
  });

  return router;
}
