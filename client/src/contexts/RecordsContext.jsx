import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { CATEGORY_THEMES } from '../utils/categoryTheme';

const RecordsContext = createContext(null);

export function RecordsProvider({ children }) {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [categories, setCategories] = useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('homesprout_theme') || 'dark';
  });

  // 获取所有记录
  const fetchRecords = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      const result = await api.getRecords(filters);
      setRecords(result.records || []);
      return result;
    } catch (err) {
      console.error('获取记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error('获取统计失败:', err);
    }
  }, []);

  // 获取分类列表并动态注册主题
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await api.getCategories();
      cats.forEach(c => {
        if (!CATEGORY_THEMES[c.label]) {
          const gradientStr = Array.isArray(c.gradient)
            ? `linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]})`
            : (c.gradient || 'linear-gradient(135deg, #64748B, #94A3B8)');
          
          const startColor = Array.isArray(c.gradient) ? c.gradient[0] : '#64748B';
          const endColor = Array.isArray(c.gradient) ? c.gradient[1] : '#94A3B8';

          CATEGORY_THEMES[c.label] = {
            id: c.id,
            label: c.label,
            icon: c.icon || '📁',
            gradient: gradientStr,
            colorStart: startColor,
            colorEnd: endColor,
            bgLight: `rgba(100, 116, 139, 0.15)`,
            colorRGB: '100, 116, 139'
          };
        }
      });
      setCategories(cats);
    } catch (err) {
      console.error('加载分类配置失败:', err);
    }
  }, []);

  // 新增分类
  const addCategory = useCallback(async (categoryData) => {
    try {
      const response = await api.addCategory(categoryData);
      await fetchCategories();
      return response.category;
    } catch (err) {
      console.error('创建分类失败:', err);
      throw err;
    }
  }, [fetchCategories]);

  const toggleHighlight = useCallback(async (uuid, currentVal) => {
    const localRecord = records.find(r => r.uuid === uuid);
    const isHighlight = currentVal !== undefined ? currentVal : (localRecord?.is_highlight || false);
    try {
      const updated = await api.updateRecord(uuid, { is_highlight: !isHighlight });
      setRecords(prev => prev.map(r =>
        r.uuid === uuid ? { ...r, is_highlight: updated.is_highlight } : r
      ));
      fetchStats(); // 重新计算统计信息
      return updated;
    } catch (err) {
      console.error('切换高光失败:', err);
      alert(err.message || '操作失败');
      throw err;
    }
  }, [records, fetchStats]);

  // WebSocket 处理新记录通知与主题实时同步
  const handleWsMessage = useCallback((message) => {
    if (message.type === 'NEW_RECORD') {
      setNotification({
        type: 'new_record',
        data: message.data,
        timestamp: Date.now()
      });
      // 刷新列表和统计
      fetchRecords();
      fetchStats();
    } else if (message.type === 'THEME_UPDATED') {
      console.log('[Theme] 收到局域网全局主题更新同步:', message.theme);
      setTheme(message.theme);
    }
  }, [fetchRecords, fetchStats]);

  const { connected } = useWebSocket(handleWsMessage);

  // 初始加载
  useEffect(() => {
    fetchRecords();
    fetchStats();
    fetchCategories();
    // 异步加载后台全局配置的主题样式
    api.getTheme()
      .then(res => {
        if (res && res.theme) {
          setTheme(res.theme);
        }
      })
      .catch(err => console.error('读取全局主题样式失败:', err));
  }, [fetchRecords, fetchStats, fetchCategories]);

  // 监听主题变化并应用类
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      if (meta) meta.setAttribute('content', '#f1f5f9');
    } else {
      document.documentElement.classList.remove('theme-light');
      if (meta) meta.setAttribute('content', '#0f0f23');
    }
    localStorage.setItem('homesprout_theme', theme);
  }, [theme]);

  // 更新全局主题，并持久化到后台配置
  const updateTheme = useCallback(async (newTheme) => {
    setTheme(newTheme);
    try {
      await api.setTheme(newTheme);
    } catch (err) {
      console.error('保存全局显示模式失败:', err);
    }
  }, []);

  // 清除通知
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <RecordsContext.Provider value={{
      records, stats, loading, notification, connected, categories, theme, setTheme: updateTheme,
      fetchRecords, fetchStats, fetchCategories, addCategory, toggleHighlight, setRecords
    }}>
      {children}
    </RecordsContext.Provider>
  );
}

export function useRecordsContext() {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error('useRecordsContext must be used within RecordsProvider');
  return ctx;
}
