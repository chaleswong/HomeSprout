export const CATEGORY_THEMES = {
  '积木': {
    id: 'building',
    label: '积木',
    icon: '🧱',
    gradient: 'linear-gradient(135deg, #FF6B35, #FF8E53)',
    colorStart: '#FF6B35',
    colorEnd: '#FF8E53',
    bgLight: 'rgba(255, 107, 53, 0.15)',
    colorRGB: '255, 107, 53'
  },
  '绘画': {
    id: 'drawing',
    label: '绘画',
    icon: '🎨',
    gradient: 'linear-gradient(135deg, #667EEA, #764BA2)',
    colorStart: '#667EEA',
    colorEnd: '#764BA2',
    bgLight: 'rgba(102, 126, 234, 0.15)',
    colorRGB: '102, 126, 234'
  },
  '数独': {
    id: 'sudoku',
    label: '数独',
    icon: '🔢',
    gradient: 'linear-gradient(135deg, #11998E, #38EF7D)',
    colorStart: '#11998E',
    colorEnd: '#38EF7D',
    bgLight: 'rgba(17, 153, 142, 0.15)',
    colorRGB: '17, 153, 142'
  },
  '编程': {
    id: 'coding',
    label: '编程',
    icon: '💻',
    gradient: 'linear-gradient(135deg, #4FACFE, #00F2FE)',
    colorStart: '#4FACFE',
    colorEnd: '#00F2FE',
    bgLight: 'rgba(79, 172, 254, 0.15)',
    colorRGB: '79, 172, 254'
  },
  '舞台表现': {
    id: 'performance',
    label: '舞台表现',
    icon: '🎭',
    gradient: 'linear-gradient(135deg, #A855F7, #EC4899)',
    colorStart: '#A855F7',
    colorEnd: '#EC4899',
    bgLight: 'rgba(168, 85, 247, 0.15)',
    colorRGB: '168, 85, 247'
  },
  '未知': {
    id: 'unknown',
    label: '未知',
    icon: '📎',
    gradient: 'linear-gradient(135deg, #64748B, #94A3B8)',
    colorStart: '#64748B',
    colorEnd: '#94A3B8',
    bgLight: 'rgba(100, 116, 139, 0.15)',
    colorRGB: '100, 116, 139'
  }
};

export function getCategoryTheme(category) {
  return CATEGORY_THEMES[category] || CATEGORY_THEMES['未知'];
}

export function getAllCategories() {
  return Object.values(CATEGORY_THEMES);
}
