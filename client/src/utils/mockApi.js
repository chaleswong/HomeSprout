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
    mock_url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800"
  },
  {
    uuid: "rec-3",
    title: "Scratch 小猫钓鱼游戏",
    category: "编程",
    date: "2026-06-28 14:00:00",
    media_type: "image",
    original_filename: "scratch_game.png",
    is_highlight: false,
    description: "Skye 用 Scratch 制作了一个有趣的小猫钓鱼游戏，实现了角色移动、碰撞检测和计分系统。",
    ai_metadata: {
      description: "Skye 用 Scratch 制作了一个有趣的小猫钓鱼游戏，实现了角色移动、碰撞检测和计分系统。",
      confidence: 0.88
    },
    mock_url: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800"
  },
  {
    uuid: "rec-4",
    title: "静夜思朗诵",
    category: "舞台表现",
    date: "2026-06-25 20:00:00",
    media_type: "audio",
    original_filename: "poem_recite.mp3",
    is_highlight: false,
    description: "Skye 朗诵李白的《静夜思》，声音清晰，感情饱满，节奏感很好。",
    ai_metadata: {
      description: "Skye 朗诵李白的《静夜思》，声音清晰，感情饱满，节奏感很好。",
      confidence: 0.9
    },
    mock_url: ""
  },
  {
    uuid: "rec-5",
    title: "数学数独挑战",
    category: "数独",
    date: "2026-06-22 16:00:00",
    media_type: "image",
    original_filename: "sudoku_solve.jpg",
    is_highlight: false,
    description: "Skye 完成了一道中等难度的数独题，用时15分钟，全部正确。",
    ai_metadata: {
      description: "Skye 完成了一道中等难度的数独题，用时15分钟，全部正确。",
      confidence: 0.85
    },
    mock_url: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?w=800"
  },
  {
    uuid: "rec-6",
    title: "麦克狐探案记阅读",
    category: "阅读",
    date: "2026-06-20 19:30:00",
    media_type: "image",
    original_filename: "reading_photo.jpg",
    is_highlight: true,
    description: "Skye 阅读《麦克狐探案记》，能够复述故事情节，理解人物关系。",
    ai_metadata: {
      description: "Skye 阅读《麦克狐探案记》，能够复述故事情节，理解人物关系。",
      confidence: 0.93
    },
    mock_url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"
  },
  {
    uuid: "rec-7",
    title: "幼儿园表演舞蹈",
    category: "舞台表现",
    date: "2026-06-18 09:00:00",
    media_type: "video",
    original_filename: "dance_performance.mp4",
    is_highlight: true,
    description: "Skye 在幼儿园毕业典礼上表演舞蹈，动作优美，表情丰富。",
    ai_metadata: {
      description: "Skye 在幼儿园毕业典礼上表演舞蹈，动作优美，表情丰富。",
      confidence: 0.94
    },
    mock_url: ""
  },
  {
    uuid: "rec-8",
    title: "海底世界创意画",
    category: "绘画",
    date: "2026-06-15 17:00:00",
    media_type: "image",
    original_filename: "underwater_world.jpg",
    is_highlight: false,
    description: "Skye 创作了一幅海底世界创意画，色彩鲜艳，充满想象力。",
    ai_metadata: {
      description: "Skye 创作了一幅海底世界创意画，色彩鲜艳，充满想象力。",
      confidence: 0.91
    },
    mock_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"
  },
  {
    uuid: "rec-9",
    title: "彩虹积木桥",
    category: "积木",
    date: "2026-06-10 11:00:00",
    media_type: "image",
    original_filename: "rainbow_bridge.jpg",
    is_highlight: false,
    description: "Skye 用彩色积木搭建了一座彩虹桥，对称结构，色彩搭配和谐。",
    ai_metadata: {
      description: "Skye 用彩色积木搭建了一座彩虹桥，对称结构，色彩搭配和谐。",
      confidence: 0.89
    },
    mock_url: "https://images.unsplash.com/photo-1516414679429-87df25b377f6?w=800"
  },
  {
    uuid: "rec-10",
    title: "英文儿歌演唱",
    category: "舞台表现",
    date: "2026-06-05 21:00:00",
    media_type: "audio",
    original_filename: "english_song.mp3",
    is_highlight: false,
    description: "Skye 演唱英文儿歌，发音标准，节奏感强。",
    ai_metadata: {
      description: "Skye 演唱英文儿歌，发音标准，节奏感强。",
      confidence: 0.87
    },
    mock_url: ""
  }
];

function getMockData(key, defaultValue) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setMockData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export async function fetchRecordsMock(options = {}) {
  let records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  
  if (options.category) {
    records = records.filter(r => r.category === options.category);
  }
  if (options.is_highlight === 'true') {
    records = records.filter(r => r.is_highlight);
  }
  if (options.search) {
    const query = options.search.toLowerCase();
    records = records.filter(r => 
      r.title.toLowerCase().includes(query) || 
      r.description.toLowerCase().includes(query)
    );
  }
  
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return {
    records,
    total: records.length,
    page: 1,
    total_pages: 1
  };
}

export async function fetchRecordMock(uuid) {
  const records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  return records.find(r => r.uuid === uuid) || null;
}

export async function updateRecordMock(uuid, updates) {
  const records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  const index = records.findIndex(r => r.uuid === uuid);
  if (index !== -1) {
    records[index] = { ...records[index], ...updates };
    setMockData(MOCK_RECORDS_KEY, records);
    return records[index];
  }
  return null;
}

export async function deleteRecordMock(uuid) {
  const records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  const filtered = records.filter(r => r.uuid !== uuid);
  setMockData(MOCK_RECORDS_KEY, filtered);
  return { message: '记录已移至回收站', uuid };
}

export async function fetchCategoriesMock() {
  return getMockData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
}

export async function addCategoryMock(category) {
  const categories = getMockData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  categories.push(category);
  setMockData(MOCK_CATEGORIES_KEY, categories);
  return category;
}

export async function updateCategoryMock(id, updates) {
  const categories = getMockData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  const index = categories.findIndex(c => c.id === id);
  if (index !== -1) {
    categories[index] = { ...categories[index], ...updates };
    setMockData(MOCK_CATEGORIES_KEY, categories);
    return categories[index];
  }
  return null;
}

export async function deleteCategoryMock(id) {
  const categories = getMockData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  const filtered = categories.filter(c => c.id !== id);
  setMockData(MOCK_CATEGORIES_KEY, filtered);
  return { message: '分类已删除' };
}

export async function fetchStatsMock() {
  const records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  const categories = getMockData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  
  const categoryCounts = {};
  categories.forEach(c => categoryCounts[c.label] = 0);
  records.forEach(r => {
    if (categoryCounts[r.category] !== undefined) {
      categoryCounts[r.category]++;
    }
  });
  
  return {
    total_records: records.length,
    total_highlights: records.filter(r => r.is_highlight).length,
    category_distribution: categoryCounts,
    weekly_trend: [3, 2, 1, 4, 2, 3, 2],
    milestone_count: 5
  };
}

export async function fetchGraphMock() {
  const records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  const categories = getMockData(MOCK_CATEGORIES_KEY, DEFAULT_CATEGORIES);
  
  const nodes = records.map(r => ({
    id: r.uuid,
    label: r.title,
    category: r.category,
    isHighlight: r.is_highlight,
    date: r.date,
    size: r.is_highlight ? 45 : 30
  }));
  
  const edges = [];
  for (let i = 0; i < records.length - 1; i++) {
    edges.push({
      source: records[i].uuid,
      target: records[i + 1].uuid,
      label: '时间'
    });
  }
  
  return { nodes, edges, categories };
}

export async function fetchThemeMock() {
  return getMockData(MOCK_THEME_KEY, 'dark');
}

export async function setThemeMock(theme) {
  setMockData(MOCK_THEME_KEY, theme);
  return { theme };
}

export async function exportHtmlMock(payload) {
  return {
    success: true,
    html: '<html><body><h1>导出报告（Mock）</h1></body></html>'
  };
}

export async function exportTypstMock(payload) {
  return {
    success: true,
    pdfUrl: '#',
    step: 'completed',
    progress: 100
  };
}

export function getMediaUrlMock(uuid, filename) {
  const records = getMockData(MOCK_RECORDS_KEY, DEFAULT_RECORDS);
  const record = records.find(r => r.uuid === uuid);
  if (record?.mock_url && filename.includes('thumb')) {
    return record.mock_url;
  }
  if (record?.mock_url) {
    return record.mock_url;
  }
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%231e293b' width='200' height='200'/%3E%3C/svg%3E`;
}
