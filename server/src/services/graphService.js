import fs from 'fs/promises';
import path from 'path';

let cachedGraph = null;

/**
 * 获取成长图谱拓扑数据，支持增量物理缓存及内存缓存
 * @param {import('../indexer.js').RecordIndexer} indexer - 记录索引器
 * @param {string} recordsDir - 记录存放目录
 * @returns {Promise<object>} Cytoscape.js 标准图拓扑 JSON
 */
export async function getGraphData(indexer, recordsDir) {
  const cacheFilePath = path.join(recordsDir, '../graph.json');

  // 如果索引被标记为“脏”，或者内存中没有缓存，则重建
  if (indexer.dirtyGraph || !cachedGraph) {
    try {
      console.log('[GraphService] 检测到图谱变动，正在重新构建...');
      cachedGraph = await buildGraph(indexer);
      indexer.dirtyGraph = false;

      // 异步持久化到文件，防止阻塞主响应
      fs.writeFile(cacheFilePath, JSON.stringify(cachedGraph, null, 2), 'utf-8')
        .catch(err => console.error('[GraphService] 写入 graph.json 缓存文件失败:', err.message));
    } catch (err) {
      console.error('[GraphService] 重建思维图谱失败:', err.message);
      // 降级：如果内存构建失败，尝试从文件缓存直接读取
      try {
        const raw = await fs.readFile(cacheFilePath, 'utf-8');
        cachedGraph = JSON.parse(raw);
      } catch {
        cachedGraph = { elements: { nodes: [], edges: [] } };
      }
    }
  }

  return cachedGraph;
}

/**
 * 分析记录及双链引用关系，构建图拓扑结构
 */
async function buildGraph(indexer) {
  const records = Array.from(indexer._index.values());
  const slugMap = new Map();
  const uuidSet = new Set();

  // 1. 建立 lookup 映射表以快速反向匹配
  records.forEach(r => {
    uuidSet.add(r.uuid);
    if (r._dir) {
      const slug = path.basename(r._dir);
      slugMap.set(slug, r.uuid);
    }
  });

  const nodes = [];
  const edges = [];
  const edgeSet = new Set();

  // 出入度计数映射
  const inDegreeMap = new Map();
  const outDegreeMap = new Map();

  records.forEach(r => {
    inDegreeMap.set(r.uuid, 0);
    outDegreeMap.set(r.uuid, 0);
  });

  // 2. 正则解析 Wiki-Link 并建立边
  // 语法支持：[[UUID]] 或 [[目录名称/Slug]]
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

  records.forEach(r => {
    const body = r.body || '';
    let match;
    const links = new Set();

    while ((match = wikiLinkRegex.exec(body)) !== null) {
      links.add(match[1].trim());
    }

    links.forEach(link => {
      let targetUuid = link;
      
      // 如果不是有效的 UUID，尝试在 slug 映射中查找匹配的记录
      if (!uuidSet.has(targetUuid)) {
        targetUuid = slugMap.get(link);
      }

      // 如果成功定位到合法的被引用节点，并且不是自引用
      if (targetUuid && uuidSet.has(targetUuid) && targetUuid !== r.uuid) {
        const edgeId = `edge-${r.uuid}-${targetUuid}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            data: {
              id: edgeId,
              source: r.uuid,
              target: targetUuid
            }
          });
          // 累加度数统计
          outDegreeMap.set(r.uuid, (outDegreeMap.get(r.uuid) || 0) + 1);
          inDegreeMap.set(targetUuid, (inDegreeMap.get(targetUuid) || 0) + 1);
        }
      }
    });
  });

  // 3. 构建节点（携带主色调、度数、高光、缩略图等）
  records.forEach(r => {
    const totalDegree = (inDegreeMap.get(r.uuid) || 0) + (outDegreeMap.get(r.uuid) || 0);
    const color = r.dominant_color || '#64748b'; // 默认使用 slate 灰色
    
    // 如果有封面图片，提供静态服务缩略图路径
    let coverUrl = null;
    if (r.media_type === 'image') {
      coverUrl = `/api/records/${r.uuid}/media/thumb.webp`;
    }

    nodes.push({
      data: {
        id: r.uuid,
        label: r.title || '未命名',
        category: r.ai_metadata?.primary_category || '未知',
        color: color,
        isHighlight: r.is_highlight ? 'true' : 'false',
        degree: totalDegree,
        cover: coverUrl
      }
    });
  });

  return {
    elements: {
      nodes,
      edges
    }
  };
}
