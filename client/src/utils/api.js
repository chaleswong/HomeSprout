const API_BASE = '/api';

// ── 检测是否为 GitHub Pages 静态预览 Demo 模式 ───────────────────────
const isDemoMode = 
  window.location.hostname.endsWith('github.io') || 
  window.location.search.includes('demo=true') ||
  window.location.hostname === 'localhost' && window.location.search.includes('mock=true');

console.log(`🌱 [HomeSprout] 运行模式: ${isDemoMode ? 'GitHub Pages 静态 Demo 模拟模式' : '局域网全栈模式'}`);

// ── 模拟本地数据库存储 ───────────────────────────────────────────────
const MOCK_CATEGORIES_KEY = 'homesprout_mock_categories';
const MOCK_RECORDS_KEY = 'homesprout_mock_records';
const MOCK_THEME_KEY = 'homesprout_mock_theme';

const DEFAULT_CATEGORIES = [
  { id: "building", label: "积木", dimension: "动手创造能力", gradient: ["#FF6B35", "#FF8E53"], icon: "🏰" },
  { id: "drawing", label: "绘画", dimension: "艺术创作能力", gradient: ["#667EEA", "#764BA2"], icon: "🎨" },
  { id: "sudoku", label: "数独", dimension: "逻辑思维能力", gradient: ["#11998E", "#38EF7D"], icon: "🧩" },
  { id: "coding", label: "编程", dimension: "逻辑思维能力", gradient: ["#4FACFE", "#00F2FE"], icon: "💻" },
  { id: "performance", label: "舞台表现", dimension: "艺术表达能力", gradient: ["#A855F7", "#EC4899"], icon: "🎤" },
  { id: "reading", label: "阅读", dimension: "语言文学素养", gradient: ["#8A2387", "#E94057"], icon: "📖" }
];

const DEFAULT_RECORDS = [
  {
    uuid: "rec-1",
    title: "Skye 的巨型乐高魔法城堡",
    category: "积木",
    date: "2026-07-02 10:15:00",
    media_type: "image",
    original_filename: "lego_castle.jpg",
    is_highlight: true,
    description: "Skye 今天用一下午时间拼搭了一个乐高城堡，包含了四个角楼和一个活动城门，展示了极佳的空间想象力与动手能力！",
    ai_metadata: {
      description: "Skye 今天用一下午时间拼搭了一个乐高城堡，包含了四个角楼和一个活动城门，展示了极佳的空间想象力与动手能力！",
      confidence: 0.95
    },
    mock_url: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800"
  },
  {
    uuid: "rec-2",
    title: "夏日向日葵水彩画",
    category: "绘画",
    date: "2026-07-01 15:30:00",
    media_type: "image",
    original_filename: "sunflower.jpg",
    is_highlight: true,
    description: "Skye 在美术课上创作的水彩画，暖色调饱满，花瓣的渐变涂色非常有层次，表达了夏日的生机与活力。",
    ai_metadata: {
      description: "Skye 在美术课上创作的水彩画，暖色调饱满，花瓣的渐变涂色非常有层次，表达了夏日的生机与活力。",
      confidence: 0.92
    },
    mock_url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800"
  },
  {
    uuid: "rec-3",
    title: "九宫格数独大通关",
    category: "数独",
    date: "2026-06-30 19:20:00",
    media_type: "image",
    original_filename: "sudoku_grid.jpg",
    is_highlight: false,
    description: "第一次在 10 分钟内独立解开了一道中级数独题，排除法与唯余法运用得非常纯熟，逻辑思维能力进步飞速！",
    ai_metadata: {
      description: "第一次在 10 分钟内独立解开了一道中级数独题，排除法与唯余法运用得非常纯熟，逻辑思维能力进步飞速！",
      confidence: 0.98
    },
    mock_url: "https://images.unsplash.com/photo-1603137356511-53e4fcb54025?w=800"
  },
  {
    uuid: "rec-4",
    title: "Scratch 制作的弹球小游戏",
    category: "编程",
    date: "2026-06-29 14:00:00",
    media_type: "image",
    original_filename: "scratch.png",
    is_highlight: true,
    description: "利用克隆积木制作了关卡阻挡板，用条件判定实现了球碰撞反弹和得分累计，逻辑链完整，编程思维很棒！",
    ai_metadata: {
      description: "利用克隆积木制作了关卡阻挡板，用条件判定实现了球碰撞反弹和得分累计，逻辑链完整，编程思维很棒！",
      confidence: 0.94
    },
    mock_url: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800"
  },
  {
    uuid: "rec-5",
    title: "朗诵《再别康桥》音频",
    category: "舞台表现",
    date: "2026-06-28 09:30:00",
    media_type: "audio",
    original_filename: "poems.mp3",
    is_highlight: false,
    description: "Skye 的康桥诗朗诵，声音清脆，字正腔圆，情感饱满，重音和停顿拿捏得非常到位，很有舞台感。",
    ai_metadata: {
      description: "Skye 的康桥诗朗诵，声音清脆，字正腔圆，情感饱满，重音和停顿拿捏得非常到位，很有舞台感。",
      confidence: 0.9
    },
    mock_url: ""
  },
  {
    uuid: "rec-6",
    title: "自主阅读《神探麦克狐》",
    category: "阅读",
    date: "2026-06-27 16:45:00",
    media_type: "image",
    original_filename: "reading_book.jpg",
    is_highlight: false,
    description: "半小时内专心阅读了三章探案故事，并给爸爸讲述了麦克狐用浮力原理破案的细节，阅读理解力出色！",
    ai_metadata: {
      description: "半小时内专心阅读了三章探案故事，并给爸爸讲述了麦克狐用浮力原理破案的细节，阅读理解力出色！",
      confidence: 0.89
    },
    mock_url: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800"
  }
];

function getLocalData(key, defaultData) {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultData));
    return defaultData;
  }
  return JSON.parse(data);
}

function setLocalData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── API 核心工具封装 ────────────────────────────────────────────────
async function fetchJSON(url, options = {}) {
  const token = localStorage.getItem('homesprout_admin_token') || 'homesprout-admin-2026';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'API 请求失败');
  }
  return response.json();
}

// ── 导出 API（智能判别路由模式与静态 Demo 模拟模式） ───────────────────
export const api = {
  // Records
  getRecords: (params = {}) => {
    if (isDemoMode) {
      let list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      if (params.category && params.category !== '全部') {
        list = list.filter(r => r.category === params.category);
      }
      if (params.is_highlight === 'true') {
        list = list.filter(r => r.is_highlight);
      }
      if (params.search) {
        const query = params.search.toLowerCase();
        list = list.filter(r => r.title.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query));
      }
      return Promise.resolve({ records: list });
    }
    const qs = new URLSearchParams(params).toString();
    return fetchJSON(`/records${qs ? '?' + qs : ''}`);
  },

  getRecord: (uuid) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const item = list.find(r => r.uuid === uuid);
      if (!item) return Promise.reject(new Error('作品不存在'));
      return Promise.resolve(item);
    }
    return fetchJSON(`/records/${uuid}`);
  },

  updateRecord: (uuid, data) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const idx = list.findIndex(r => r.uuid === uuid);
      if (idx === -1) return Promise.reject(new Error('作品不存在'));
      const updated = { ...list[idx], ...data };
      list[idx] = updated;
      setLocalData(MOCK_RECORDS_KEY, list);
      return Promise.resolve(updated);
    }
    return fetchJSON(`/records/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  deleteRecord: (uuid) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const filtered = list.filter(r => r.uuid !== uuid);
      setLocalData(MOCK_RECORDS_KEY, filtered);
      return Promise.resolve({ message: '删除成功' });
    }
    return fetchJSON(`/records/${uuid}`, { method: 'DELETE' });
  },

  getRecordFiles: (uuid) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const item = list.find(r => r.uuid === uuid);
      if (!item) return Promise.resolve({ files: [] });
      return Promise.resolve({ files: item.original_filename ? [item.original_filename] : [] });
    }
    return fetchJSON(`/records/${uuid}/files`);
  },

  getMediaUrl: (uuid, filename) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const item = list.find(r => r.uuid === uuid);
      return item?.mock_url || "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800";
    }
    return `${API_BASE}/records/${uuid}/media/${filename}`;
  },

  getGraphData: () => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const nodes = list.map(r => ({
        data: {
          id: r.uuid,
          label: r.title,
          category: r.category,
          is_highlight: r.is_highlight
        }
      }));
      // 简单生成一条关联模拟线
      const edges = list.length > 1 ? [{
        data: { id: 'edge-1', source: list[0].uuid, target: list[1].uuid }
      }] : [];
      return Promise.resolve({ nodes, edges });
    }
    return fetchJSON('/records/graph');
  },

  // Upload
  uploadFile: async (file, title = '') => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const newRec = {
        uuid: `rec-${Date.now()}`,
        title: title || file.name.substring(0, file.name.lastIndexOf('.')),
        category: "绘画", // 默认模拟分类
        date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        media_type: file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'image',
        original_filename: file.name,
        is_highlight: false,
        description: "在网页预览沙盒中投喂成功！这是您的本地模拟成长档案数据。",
        mock_url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800"
      };
      list.unshift(newRec);
      setLocalData(MOCK_RECORDS_KEY, list);
      return Promise.resolve(newRec);
    }
    const formData = new FormData();
    if (title) {
      formData.append('title', title);
    }
    formData.append('file', file);
    const token = localStorage.getItem('homesprout_admin_token') || 'homesprout-admin-2026';
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) throw new Error('上传失败');
    return response.json();
  },

  uploadFiles: async (files, title = '') => {
    if (isDemoMode) {
      return api.uploadFile(files[0], title);
    }
    const formData = new FormData();
    if (title) {
      formData.append('title', title);
    }
    for (const file of files) {
      formData.append('files', file);
    }
    const token = localStorage.getItem('homesprout_admin_token') || 'homesprout-admin-2026';
    const response = await fetch(`${API_BASE}/upload/batch`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) throw new Error('批量上传失败');
    return response.json();
  },

  // Stats
  getStats: () => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const categories = {};
      list.forEach(r => {
        categories[r.category] = (categories[r.category] || 0) + 1;
      });
      return Promise.resolve({
        total: list.length,
        highlights: list.filter(r => r.is_highlight).length,
        weeklyNew: list.filter(r => new Date(r.date) > new Date(Date.now() - 7*24*60*60*1000)).length,
        categories
      });
    }
    return fetchJSON('/stats/overview');
  },

  getTimeline: () => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const groups = {};
      list.forEach(r => {
        const month = r.date.substring(0, 7); // YYYY-MM
        if (!groups[month]) groups[month] = [];
        groups[month].push(r);
      });
      return Promise.resolve(groups);
    }
    return fetchJSON('/stats/timeline');
  },

  getDashboard: () => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const categories = getLocalData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES).filter(c => c.id !== 'unknown');
      
      const categoryCounts = {};
      list.forEach(r => {
        categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      });

      const BADGE_LEVELS = [
        { level: '初级', threshold: 1,  emoji: '🌱', label: '初出茅庐' }, // 沙盒降低门槛方便预览演示
        { level: '中级', threshold: 3, emoji: '🌿', label: '初露锋芒' },
        { level: '大师', threshold: 5, emoji: '🌳', label: '炉火纯青' },
      ];

      const radarMap = new Map();
      categories.forEach(cat => {
        const dim = cat.dimension || cat.label;
        const count = categoryCounts[cat.label] || 0;
        if (radarMap.has(dim)) {
          const ext = radarMap.get(dim);
          ext.count += count;
          ext.labels.push(cat.label);
        } else {
          radarMap.set(dim, {
            dimension: dim,
            labels: [cat.label],
            count,
            gradient: cat.gradient,
            icon: cat.icon
          });
        }
      });

      const milestones = categories.map(cat => {
        const count = categoryCounts[cat.label] || 0;
        return {
          categoryId: cat.id,
          label: cat.label,
          dimension: cat.dimension || cat.label,
          icon: cat.icon,
          gradient: cat.gradient,
          count,
          badges: BADGE_LEVELS.map(b => ({
            ...b,
            unlocked: count >= b.threshold
          }))
        };
      });

      return Promise.resolve({
        radarData: Array.from(radarMap.values()),
        milestones,
        totalWorks: list.length,
        totalHighlights: list.filter(r => r.is_highlight).length,
        activeDays: 3
      });
    }
    return fetchJSON('/stats/dashboard');
  },

  // Export
  getExportPreview: (uuids) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
      const filtered = list.filter(r => uuids.includes(r.uuid));
      return Promise.resolve(filtered);
    }
    return fetchJSON('/export/preview', {
      method: 'POST',
      body: JSON.stringify({ uuids })
    });
  },

  getExportHTML: (uuids, title) => {
    if (isDemoMode) {
      return Promise.resolve(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; background: #0f0f23; color: #fff;">
            <h1>🌱 ${title} — 网页版作品集 PDF 预览</h1>
            <p>（在 GitHub Pages 静态沙盒模式下，此页模拟 Typst/A4 导出结果。在局域网全栈模式下将编译为真实的精美 Typst 纸质 PDF 文档）</p>
          </body>
        </html>
      `);
    }
    return fetchJSON('/export/html', {
      method: 'POST',
      body: JSON.stringify({ uuids, title })
    });
  },

  // Config - categories
  getCategories: () => {
    if (isDemoMode) {
      return Promise.resolve(getLocalData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES));
    }
    return fetchJSON('/config/categories');
  },

  addCategory: (categoryData) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
      list.push(categoryData);
      setLocalData(MOCK_CATEGORIES_KEY, list);
      return Promise.resolve({ message: '添加成功', category: categoryData });
    }
    return fetchJSON('/config/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  },

  updateCategoryDimension: (id, dimension) => {
    if (isDemoMode) {
      const list = getLocalData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
      const idx = list.findIndex(c => c.id === id);
      if (idx !== -1) {
        list[idx].dimension = dimension;
        setLocalData(MOCK_CATEGORIES_KEY, list);
      }
      return Promise.resolve({ message: '更新成功' });
    }
    return fetchJSON(`/config/category/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dimension })
    });
  },

  getTheme: () => {
    if (isDemoMode) {
      const theme = localStorage.getItem(MOCK_THEME_KEY) || 'dark';
      return Promise.resolve({ theme });
    }
    return fetchJSON('/config/theme');
  },

  setTheme: (theme) => {
    if (isDemoMode) {
      localStorage.setItem(MOCK_THEME_KEY, theme);
      return Promise.resolve({ theme });
    }
    return fetchJSON('/config/theme', {
      method: 'POST',
      body: JSON.stringify({ theme })
    });
  },

  getHealth: () => {
    if (isDemoMode) {
      return Promise.resolve({
        status: 'ok',
        uptime: 99999,
        timestamp: new Date().toISOString(),
        records: getLocalData(MOCK_RECORDS_KEY, DEFAULT_RECORDS).length,
        queue: { pending: 0, active: 0 }
      });
    }
    return fetchJSON('/health');
  }
};
