const API_BASE = '/api';

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

export const api = {
  // Records
  getRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJSON(`/records${qs ? '?' + qs : ''}`);
  },
  getRecord: (uuid) => fetchJSON(`/records/${uuid}`),
  updateRecord: (uuid, data) => fetchJSON(`/records/${uuid}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteRecord: (uuid) => fetchJSON(`/records/${uuid}`, { method: 'DELETE' }),
  getRecordFiles: (uuid) => fetchJSON(`/records/${uuid}/files`),
  getMediaUrl: (uuid, filename) => `${API_BASE}/records/${uuid}/media/${filename}`,
  getGraphData: () => fetchJSON('/records/graph'),

  // Upload
  uploadFile: async (file, title = '') => {
    const formData = new FormData();
    if (title) {
      formData.append('title', title);
    }
    formData.append('file', file);
    const token = localStorage.getItem('homesprout_admin_token') || 'homesprout-admin-2026';
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) throw new Error('上传失败');
    return response.json();
  },
  uploadFiles: async (files, title = '') => {
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
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) throw new Error('批量上传失败');
    return response.json();
  },

  // Stats
  getStats: () => fetchJSON('/stats/overview'),
  getTimeline: () => fetchJSON('/stats/timeline'),
  getDashboard: () => fetchJSON('/stats/dashboard'),

  // Export
  getExportPreview: (uuids) => fetchJSON('/export/preview', {
    method: 'POST',
    body: JSON.stringify({ uuids })
  }),
  getExportHTML: (uuids, title) => fetchJSON('/export/html', {
    method: 'POST',
    body: JSON.stringify({ uuids, title })
  }),

  // Config - categories
  getCategories: () => fetchJSON('/config/categories'),
  addCategory: (categoryData) => fetchJSON('/config/categories', {
    method: 'POST',
    body: JSON.stringify(categoryData)
  }),
  updateCategoryDimension: (id, dimension) => fetchJSON(`/config/category/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ dimension })
  }),
  getTheme: () => fetchJSON('/config/theme'),
  setTheme: (theme) => fetchJSON('/config/theme', {
    method: 'POST',
    body: JSON.stringify({ theme })
  }),
  getHealth: () => fetchJSON('/health')
};
