import path from 'path';
import fs from 'fs/promises';
import { readRecordMeta } from './utils/fileHelpers.js';
import { startOfWeek, isAfter } from 'date-fns';

/**
 * 记录索引器
 * 维护内存中的 Map 索引，支持查询、过滤、分页
 */
export class RecordIndexer {
  constructor() {
    // uuid -> record 的内存索引
    this._index = new Map();
    this._recordsDir = '';
    this.dirtyGraph = true;
  }

  /**
   * 初始化：递归扫描 records 目录，加载所有 index.md
   * @param {string} recordsDir - 记录根目录
   */
  async init(recordsDir) {
    this._recordsDir = recordsDir;
    this._index.clear();

    try {
      await fs.access(recordsDir);
    } catch {
      // 目录不存在则跳过
      console.log('[Indexer] 记录目录不存在，跳过初始化扫描');
      return;
    }

    // 递归查找所有 index.md 文件
    const indexFiles = await this._findIndexFiles(recordsDir);
    console.log(`[Indexer] 发现 ${indexFiles.length} 条记录，正在加载...`);

    for (const indexPath of indexFiles) {
      try {
        await this.addFromFile(indexPath);
      } catch (error) {
        console.warn(`[Indexer] 加载记录失败: ${indexPath}`, error.message);
      }
    }

    console.log(`[Indexer] 索引加载完成，共 ${this._index.size} 条记录`);
    this.dirtyGraph = true;
  }

  /**
   * 递归查找目录下所有 index.md 文件
   */
  async _findIndexFiles(dir) {
    const results = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subResults = await this._findIndexFiles(fullPath);
          results.push(...subResults);
        } else if (entry.name === 'index.md') {
          results.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`[Indexer] 读取目录失败: ${dir}`, error.message);
    }

    return results;
  }

  /**
   * 从 index.md 文件添加单条记录到索引
   * @param {string} indexPath - index.md 路径
   */
  async addFromFile(indexPath) {
    const { metadata, body } = await readRecordMeta(indexPath);

    if (!metadata.uuid) {
      console.warn(`[Indexer] 记录缺少 uuid: ${indexPath}`);
      return;
    }

    // 存储记录数据，包括文件路径信息
    this._index.set(metadata.uuid, {
      ...metadata,
      body,
      _indexPath: indexPath,
      _dir: path.dirname(indexPath),
    });
    this.dirtyGraph = true;
  }

  /**
   * 更新已有记录
   * @param {string} uuid - 记录 UUID
   * @param {object} updates - 需要更新的字段
   */
  update(uuid, updates) {
    const record = this._index.get(uuid);
    if (!record) {
      throw new Error(`记录不存在: ${uuid}`);
    }

    const updated = {
      ...record,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this._index.set(uuid, updated);
    this.dirtyGraph = true;
    return updated;
  }

  /**
   * 从索引中删除记录
   * @param {string} uuid - 记录 UUID
   */
  remove(uuid) {
    const deleted = this._index.delete(uuid);
    if (deleted) {
      this.dirtyGraph = true;
    }
    return deleted;
  }

  /**
   * 获取单条记录
   * @param {string} uuid - 记录 UUID
   * @returns {object|undefined}
   */
  get(uuid) {
    return this._index.get(uuid);
  }

  /**
   * 查询记录，支持过滤、搜索、排序、分页
   * @param {object} params - 查询参数
   * @returns {{ records: object[], total: number, page: number, limit: number }}
   */
  query({
    category,
    status,
    is_highlight,
    year,
    month,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    let records = Array.from(this._index.values());

    // 按分类过滤
    if (category) {
      records = records.filter(
        (r) => r.ai_metadata?.primary_category === category
      );
    }

    // 按状态过滤
    if (status) {
      records = records.filter((r) => r.status === status);
    }

    // 按高亮过滤
    if (is_highlight !== undefined) {
      const highlight = is_highlight === 'true' || is_highlight === true;
      records = records.filter((r) => r.is_highlight === highlight);
    }

    // 按年份过滤
    if (year) {
      records = records.filter((r) => {
        const d = new Date(r.date);
        return d.getFullYear() === parseInt(year, 10);
      });
    }

    // 按月份过滤
    if (month) {
      records = records.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() + 1 === parseInt(month, 10);
      });
    }

    // 关键词搜索（标题、标签、文件名）
    if (search) {
      const keyword = search.toLowerCase();
      records = records.filter((r) => {
        const title = (r.title || '').toLowerCase();
        const tags = (r.tags || []).join(' ').toLowerCase();
        const filename = (r.original_filename || '').toLowerCase();
        return (
          title.includes(keyword) ||
          tags.includes(keyword) ||
          filename.includes(keyword)
        );
      });
    }

    // 按日期降序排列
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = records.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const start = (pageNum - 1) * limitNum;
    const paged = records.slice(start, start + limitNum);

    return {
      records: paged,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * 获取统计数据
   * @returns {{ total: number, categories: object, highlights: number, weeklyNew: number }}
   */
  getStats() {
    const records = Array.from(this._index.values());
    const categories = {};
    let highlights = 0;
    let weeklyNew = 0;

    // 本周起始时间（周一）
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    for (const record of records) {
      // 统计各分类数量
      const cat = record.ai_metadata?.primary_category || '未知';
      categories[cat] = (categories[cat] || 0) + 1;

      // 统计高亮数量
      if (record.is_highlight) {
        highlights++;
      }

      // 统计本周新增
      const recordDate = new Date(record.created_at || record.date);
      if (isAfter(recordDate, weekStart)) {
        weeklyNew++;
      }
    }

    return {
      total: records.length,
      categories,
      highlights,
      weeklyNew,
    };
  }

  /**
   * 获取时间线数据，按 YYYY-MM 分组
   * @returns {object} { 'YYYY-MM': record[] }
   */
  getTimelineData() {
    const records = Array.from(this._index.values());
    const timeline = {};

    // 按日期降序排列
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    for (const record of records) {
      const d = new Date(record.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!timeline[key]) {
        timeline[key] = [];
      }
      timeline[key].push(record);
    }

    return timeline;
  }
}
