const API_BASE = '/api';

const isDemoMode = 
  window.location.hostname.endsWith('github.io') || 
  window.location.search.includes('demo=true') ||
  window.location.hostname === 'localhost' && window.location.search.includes('mock=true');

console.log(`🌱 [HomeSprout] 运行模式: ${isDemoMode ? 'GitHub Pages 静态 Demo 模拟模式' : '局域网全栈模式'}`);

async function fetchJSON(url, options = {}) {
  const token = localStorage.getItem('homesprout_admin_token');
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

async function uploadFileReal(file, title = '') {
  const formData = new FormData();
  if (title) {
    formData.append('title', title);
  }
  formData.append('file', file);
  const token = localStorage.getItem('homesprout_admin_token');
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  if (!response.ok) throw new Error('上传失败');
  return response.json();
}

async function uploadFilesReal(files, title = '') {
  const formData = new FormData();
  if (title) {
    formData.append('title', title);
  }
  for (const file of files) {
    formData.append('files', file);
  }
  const token = localStorage.getItem('homesprout_admin_token');
  const response = await fetch(`${API_BASE}/upload/batch`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  if (!response.ok) throw new Error('批量上传失败');
  return response.json();
}

if (isDemoMode) {
  import('./mockApi.js').then((mock) => {
    window.__mockApi = mock;
  });
}

export const api = {
  getRecords: async (params = {}) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.fetchRecordsMock(params));
    }
    const qs = new URLSearchParams(params).toString();
    return fetchJSON(`/records${qs ? '?' + qs : ''}`);
  },

  getRecord: async (uuid) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.fetchRecordMock(uuid));
    }
    return fetchJSON(`/records/${uuid}`);
  },

  updateRecord: async (uuid, data) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.updateRecordMock(uuid, data));
    }
    return fetchJSON(`/records/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  deleteRecord: async (uuid) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.deleteRecordMock(uuid));
    }
    return fetchJSON(`/records/${uuid}`, { method: 'DELETE' });
  },

  getRecordFiles: async (uuid) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => ({ files: [] }));
    }
    return fetchJSON(`/records/${uuid}/files`);
  },

  getMediaUrl: (uuid, filename) => {
    if (isDemoMode) {
      try {
        const mockApi = require('./mockApi.js');
        return mockApi.getMediaUrlMock(uuid, filename);
      } catch {
        return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%231e293b" width="200" height="200"/></svg>`;
      }
    }
    return `${API_BASE}/records/${uuid}/media/${filename}`;
  },

  getGraphData: async () => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.fetchGraphMock());
    }
    return fetchJSON('/records/graph');
  },

  uploadFile: async (file, title = '') => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(async (m) => {
        const newRec = {
          uuid: `rec-${Date.now()}`,
          title: title || file.name.substring(0, file.name.lastIndexOf('.')),
          category: "绘画",
          date: new Date().toISOString().replace('T', ' ').substring(0, 19),
          media_type: file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'image',
          original_filename: file.name,
          is_highlight: false,
          description: "在网页预览沙盒中投喂成功！",
          mock_url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800"
        };
        const records = m.fetchRecordsMock({});
        return newRec;
      });
    }
    return uploadFileReal(file, title);
  },

  uploadFiles: async (files, title = '') => {
    if (isDemoMode) {
      return api.uploadFile(files[0], title);
    }
    return uploadFilesReal(files, title);
  },

  getStats: async () => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.fetchStatsMock());
    }
    return fetchJSON('/stats/overview');
  },

  getTimeline: async () => {
    if (isDemoMode) {
      const records = await import('./mockApi.js').then(m => m.fetchRecordsMock({}));
      const groups = {};
      records.records.forEach(r => {
        const month = r.date.substring(0, 7);
        if (!groups[month]) groups[month] = [];
        groups[month].push(r);
      });
      return groups;
    }
    return fetchJSON('/stats/timeline');
  },

  getDashboard: async () => {
    if (isDemoMode) {
      const records = await import('./mockApi.js').then(m => m.fetchRecordsMock({}));
      const categories = await import('./mockApi.js').then(m => m.fetchCategoriesMock());
      
      const categoryCounts = {};
      records.records.forEach(r => {
        categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      });

      const BADGE_LEVELS = [
        { level: '初级', threshold: 1, emoji: '🌱', label: '初出茅庐' },
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

      return {
        radarData: Array.from(radarMap.values()),
        milestones,
        totalWorks: records.records.length,
        totalHighlights: records.records.filter(r => r.is_highlight).length,
        activeDays: 3
      };
    }
    return fetchJSON('/stats/dashboard');
  },

  getExportPreview: async (uuids) => {
    if (isDemoMode) {
      const records = await import('./mockApi.js').then(m => m.fetchRecordsMock({}));
      return records.records.filter(r => uuids.includes(r.uuid));
    }
    return fetchJSON('/export/preview', {
      method: 'POST',
      body: JSON.stringify({ uuids })
    });
  },

  getExportHTML: async (uuids, title) => {
    if (isDemoMode) {
      return `
        <html>
          <body style="font-family: sans-serif; padding: 40px; background: #0f0f23; color: #fff;">
            <h1>🌱 ${title} — 网页版作品集 PDF 预览</h1>
            <p>（在 GitHub Pages 静态沙盒模式下，此页模拟 Typst/A4 导出结果。）</p>
          </body>
        </html>
      `;
    }
    return fetchJSON('/export/html', {
      method: 'POST',
      body: JSON.stringify({ uuids, title })
    });
  },

  getCategories: async () => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.fetchCategoriesMock());
    }
    return fetchJSON('/config/categories');
  },

  addCategory: async (categoryData) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.addCategoryMock(categoryData));
    }
    return fetchJSON('/config/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  },

  updateCategoryDimension: async (id, dimension) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.updateCategoryMock(id, { dimension }));
    }
    return fetchJSON(`/config/category/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dimension })
    });
  },

  getTheme: async () => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.fetchThemeMock());
    }
    return fetchJSON('/config/theme');
  },

  setTheme: async (theme) => {
    if (isDemoMode) {
      return await import('./mockApi.js').then(m => m.setThemeMock(theme));
    }
    return fetchJSON('/config/theme', {
      method: 'POST',
      body: JSON.stringify({ theme })
    });
  },

  getHealth: async () => {
    if (isDemoMode) {
      const records = await import('./mockApi.js').then(m => m.fetchRecordsMock({}));
      return {
        status: 'ok',
        uptime: 99999,
        timestamp: new Date().toISOString(),
        records: records.records.length,
        queue: { pending: 0, active: 0 },
        ai: { enabled: false, available: false, model: 'N/A' }
      };
    }
    return fetchJSON('/health');
  }
};
