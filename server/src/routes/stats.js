import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { requireAdmin } from '../middleware/auth.js';
import { generateWeeklyDigest } from '../services/weeklyDigest.js';

/**
 * 创建统计与报表路由
 * @param {import('../indexer.js').RecordIndexer} indexer - 记录索引器
 * @param {string} recordsDir - 记录存放路径
 * @param {string} reportsDir - 报告存放路径
 * @param {object} config - 系统配置对象
 * @returns {Router}
 */
export function createStatsRouter(indexer, recordsDir, reportsDir, config) {
  const router = Router();

  // ========================
  // GET /overview - 获取总览统计数据
  // ========================
  router.get('/overview', (req, res) => {
    try {
      const stats = indexer.getStats();
      res.json(stats);
    } catch (error) {
      console.error('[Stats] 获取统计数据失败:', error.message);
      res.status(500).json({ error: '获取统计数据失败' });
    }
  });

  // ========================
  // GET /timeline - 获取时间线数据
  // ========================
  router.get('/timeline', (req, res) => {
    try {
      const timeline = indexer.getTimelineData();
      res.json(timeline);
    } catch (error) {
      console.error('[Stats] 获取时间线数据失败:', error.message);
      res.status(500).json({ error: '获取时间线数据失败' });
    }
  });

  // ========================
  // GET /weekly-digests - 获取周剪报列表
  // 需要管理员权限
  // ========================
  router.get('/weekly-digests', requireAdmin, async (req, res) => {
    try {
      await fs.mkdir(reportsDir, { recursive: true });
      const files = await fs.readdir(reportsDir);
      
      const digests = [];
      for (const file of files) {
        if (file.startsWith('weekly_') && file.endsWith('.json')) {
          const filePath = path.join(reportsDir, file);
          const raw = await fs.readFile(filePath, 'utf-8');
          try {
            const data = JSON.parse(raw);
            digests.push({
              filename: file,
              week_identifier: data.week_identifier,
              total_assets: data.data_density?.total_captured_assets || 0,
              generated_at: (await fs.stat(filePath)).mtime
            });
          } catch {
            // 跳过无效 JSON
          }
        }
      }
      
      // 按生成时间逆序排列
      digests.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
      res.json(digests);
    } catch (error) {
      console.error('[Stats] 获取周报列表失败:', error.message);
      res.status(500).json({ error: '获取周报列表失败' });
    }
  });

  // ========================
  // GET /weekly-digests/:filename - 获取特定周剪报详情
  // 需要管理员权限
  // ========================
  router.get('/weekly-digests/:filename', requireAdmin, async (req, res) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.join(reportsDir, safeFilename);
      
      await fs.access(filePath);
      const raw = await fs.readFile(filePath, 'utf-8');
      res.json(JSON.parse(raw));
    } catch (error) {
      console.error('[Stats] 获取周报详情失败:', error.message);
      res.status(404).json({ error: '周剪报文件不存在' });
    }
  });

  // ========================
  // POST /weekly-digest - 手动即时生成周剪报
  // 需要管理员权限
  // ========================
  router.post('/weekly-digest', requireAdmin, async (req, res) => {
    try {
      const digest = await generateWeeklyDigest(recordsDir, reportsDir, config);
      res.json({
        message: '周剪报生成成功',
        digest
      });
    } catch (error) {
      console.error('[Stats] 手动生成周报失败:', error.message);
      res.status(500).json({ error: '周报生成失败: ' + error.message });
    }
  });

  // ========================
  // GET /dashboard - 获取成长看板数据（雷达图 + 里程碑徽章）
  // ========================
  router.get('/dashboard', (req, res) => {
    try {
      const stats = indexer.getStats();
      const categoryCounts = stats.categories || {};

      // 里程碑等级定义
      const BADGE_LEVELS = [
        { level: '初级', threshold: 5,  emoji: '🌱', label: '初出茅庐' },
        { level: '中级', threshold: 10, emoji: '🌿', label: '初露锋芒' },
        { level: '大师', threshold: 20, emoji: '🌳', label: '炉火纯青' },
      ];

      // 过滤掉"未知"分类，并按分类构建雷达图 & 里程碑数据
      const validCategories = (config.categories || []).filter(
        (c) => c.label !== '未知' && c.id !== 'unknown'
      );

      // 构建雷达图数据：相同 dimension 的分类合并计数
      // 例如：数独(dimension=逻辑思维能力) + 编程(dimension=逻辑思维能力) → 一个轴，计数相加
      const radarMap = new Map(); // dimension → { dimension, labels[], count, gradient, icon }
      validCategories.forEach((cat) => {
        const dim = cat.dimension || cat.label;
        const count = categoryCounts[cat.label] || 0;
        if (radarMap.has(dim)) {
          const existing = radarMap.get(dim);
          existing.count += count;
          existing.labels.push(cat.label);
          // 若有更好看的渐变就沿用首个
        } else {
          radarMap.set(dim, {
            dimension: dim,
            labels: [cat.label],
            count,
            gradient: cat.gradient || ['#64748B', '#94A3B8'],
            icon: cat.icon || '',
          });
        }
      });
      const radarData = Array.from(radarMap.values());

      // 里程碑：按各自分类独立计算（不合并），方便逐项展示个人进度
      const milestones = validCategories.map((cat) => {
        const count = categoryCounts[cat.label] || 0;
        return {
          categoryId: cat.id,
          label: cat.label,
          dimension: cat.dimension || cat.label,
          icon: cat.icon || '',
          gradient: cat.gradient || ['#64748B', '#94A3B8'],
          count,
          badges: BADGE_LEVELS.map((b) => ({
            ...b,
            unlocked: count >= b.threshold,
          })),
        };
      });

      // 计算活跃天数（有上传作品的不重复日期数量）
      const allRecords = indexer.query({ limit: 9999 }).records || [];
      const activeDays = new Set(
        allRecords.map((r) => (r.date ? r.date.substring(0, 10) : null)).filter(Boolean)
      ).size;

      res.json({
        radarData,
        milestones,
        totalWorks: stats.total || 0,
        totalHighlights: stats.highlights || 0,
        activeDays,
      });
    } catch (error) {
      console.error('[Stats] 获取看板数据失败:', error.message);
      res.status(500).json({ error: '获取看板数据失败' });
    }
  });

  return router;
}
