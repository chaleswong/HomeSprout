import React, { useEffect, useState, useCallback } from 'react';
import { useRecordsContext } from '../contexts/RecordsContext';
import { api } from '../utils/api';
import { getCategoryTheme } from '../utils/categoryTheme';

const PRESET_GRADIENTS = [
  { name: '温暖落日', colors: ['#FF6B35', '#FF8E53'] },
  { name: '梦幻薰衣草', colors: ['#667EEA', '#764BA2'] },
  { name: '翡翠波浪', colors: ['#11998E', '#38EF7D'] },
  { name: '赛博天空', colors: ['#4FACFE', '#00F2FE'] },
  { name: '霓虹玫瑰', colors: ['#A855F7', '#EC4899'] },
  { name: '落日晚霞', colors: ['#8A2387', '#E94057'] },
  { name: '清新海洋', colors: ['#00c6ff', '#0072ff'] },
  { name: '金黄日光', colors: ['#F12711', '#F5AF19'] }
];

// 统一的 input 样式（适配浅/深色模式，全部使用 CSS 变量）
const INPUT_STYLE = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '6px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-glass)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  fontSize: '0.9rem',
};

export default function AdminPage() {
  const { stats, connected, categories, addCategory, fetchCategories, theme, setTheme } = useRecordsContext();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  // 新增分类表单状态
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📖');
  const [newCatDimension, setNewCatDimension] = useState('');
  const [selectedGradientIdx, setSelectedGradientIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 存量分类行内编辑状态
  const [editingDimension, setEditingDimension] = useState({});  // { catId: true }
  const [dimensionInputs, setDimensionInputs] = useState({});    // { catId: string }
  const [savingDimension, setSavingDimension] = useState({});    // { catId: true }

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.error('获取系统健康状态失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // ── 新增分类 ──
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatLabel.trim()) return alert('请输入分类名称！');
    if (!newCatIcon.trim()) return alert('请输入 Emoji 图标！');

    try {
      setIsSubmitting(true);
      const gradient = PRESET_GRADIENTS[selectedGradientIdx].colors;
      const id = 'custom-' + Date.now();

      await addCategory({
        id,
        label: newCatLabel.trim(),
        icon: newCatIcon.trim(),
        gradient,
        ...(newCatDimension.trim() ? { dimension: newCatDimension.trim() } : {})
      });

      setNewCatLabel('');
      setNewCatIcon('📖');
      setNewCatDimension('');
      setSelectedGradientIdx(0);
      alert('自定义分类创建成功！');
    } catch (err) {
      alert(err.message || '创建分类失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 存量分类维度编辑 ──
  const startEditDimension = useCallback((cat) => {
    setEditingDimension((prev) => ({ ...prev, [cat.id]: true }));
    setDimensionInputs((prev) => ({ ...prev, [cat.id]: cat.dimension || '' }));
  }, []);

  const cancelEditDimension = useCallback((catId) => {
    setEditingDimension((prev) => { const n = { ...prev }; delete n[catId]; return n; });
    setDimensionInputs((prev) => { const n = { ...prev }; delete n[catId]; return n; });
  }, []);

  const saveDimension = useCallback(async (cat) => {
    const newVal = (dimensionInputs[cat.id] || '').trim();
    setSavingDimension((prev) => ({ ...prev, [cat.id]: true }));
    try {
      await api.updateCategoryDimension(cat.id, newVal);
      // 刷新分类列表（如果 context 暴露了 fetchCategories）
      if (typeof fetchCategories === 'function') await fetchCategories();
      cancelEditDimension(cat.id);
    } catch (err) {
      alert(err.message || '保存维度名称失败');
    } finally {
      setSavingDimension((prev) => { const n = { ...prev }; delete n[cat.id]; return n; });
    }
  }, [dimensionInputs, cancelEditDimension, fetchCategories]);

  // 计算最大分类数用作比例基准
  const getMaxCategoryCount = () => {
    if (!stats?.categories) return 1;
    const counts = Object.values(stats.categories);
    return counts.length > 0 ? Math.max(...counts) : 1;
  };
  const maxCount = getMaxCategoryCount();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 标题 */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚙️</span>
        <span>系统控制面板</span>
      </h2>

      <div className="admin-grid">

        {/* 系统在线状态 */}
        <div className="admin-section glass">
          <div className="admin-title">系统在线状态</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>局域网服务运行</span>
              <span style={{ color: connected ? '#10b981' : '#f43f5e', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: connected ? '#10b981' : '#f43f5e', boxShadow: connected ? '0 0 8px #10b981' : 'none' }} />
                {connected ? '活动中' : '离线'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>系统运行时间</span>
              <span>{health?.uptime ? `${Math.floor(health.uptime / 60)} 分钟` : '正在载入...'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>本地 AI 通信</span>
              <span style={{ color: 'var(--text-muted)' }}>已就绪 (离线分类模式)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>归档监控目录</span>
              <code style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                /data/incoming/
              </code>
            </div>
          </div>
        </div>

        {/* 兴趣分类分布热力图 */}
        <div className="admin-section glass">
          <div className="admin-title">兴趣档案分布 (AI 智能分类)</div>
          <div className="admin-stat-bar-group">
            {stats?.categories && Object.keys(stats.categories).length > 0 ? (
              Object.entries(stats.categories).map(([category, count]) => {
                const catTheme = getCategoryTheme(category);
                const percentage = (count / maxCount) * 100;
                return (
                  <div className="admin-bar-row" key={category}>
                    <div className="admin-bar-label">
                      <span>{catTheme.icon} {category}</span>
                      <span style={{ fontWeight: 'bold' }}>{count} 件作品</span>
                    </div>
                    <div className="admin-bar-track">
                      <div className="admin-bar-fill" style={{ width: `${percentage}%`, background: catTheme.gradient }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                暂无分类作品，等待投喂中
              </div>
            )}
          </div>
        </div>

        {/* 系统显示主题设置 */}
        <div className="admin-section glass">
          <div className="admin-title">🎨 系统主题显示模式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              切换全站视觉风格。您可以选择暗色星空或清新亮丽，系统将自动适配移动端与桌面端。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: 'auto' }}>
              <button type="button" onClick={() => setTheme('dark')} style={{ height: '80px', borderRadius: '12px', border: theme === 'dark' ? '2px solid var(--accent-primary)' : '1px solid var(--border-glass)', background: theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)', color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: theme === 'dark' ? 'bold' : 'normal', transition: 'all 0.2s', boxShadow: theme === 'dark' ? 'var(--shadow-glow)' : 'none' }}>
                <span style={{ fontSize: '1.5rem' }}>🌙</span>
                <span style={{ fontSize: '0.85rem' }}>深色星空</span>
              </button>
              <button type="button" onClick={() => setTheme('light')} style={{ height: '80px', borderRadius: '12px', border: theme === 'light' ? '2px solid var(--accent-primary)' : '1px solid var(--border-glass)', background: theme === 'light' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)', color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: theme === 'light' ? 'bold' : 'normal', transition: 'all 0.2s', boxShadow: theme === 'light' ? 'var(--shadow-glow)' : 'none' }}>
                <span style={{ fontSize: '1.5rem' }}>☀️</span>
                <span style={{ fontSize: '0.85rem' }}>清新亮丽</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════
          分类自定义管理区（全宽）
      ════════════════════════════════════════════ */}
      <div className="admin-section glass" style={{ marginTop: '4px' }}>
        <div className="admin-title">🎨 档案兴趣分类自定义管理</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>

          {/* ── 左侧：存量分类列表（支持行内编辑维度） ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-secondary)', margin: 0 }}>
              现有全部分类
              <span style={{ fontWeight: '400', fontSize: '0.78rem', marginLeft: '8px', color: 'var(--text-muted)' }}>
                点击 ✏️ 维度 可补充雷达图名称
              </span>
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(categories || []).map(cat => {
                const catTheme = getCategoryTheme(cat.label);
                const isEditing = !!editingDimension[cat.id];
                const isSaving  = !!savingDimension[cat.id];
                const gradientStr = Array.isArray(cat.gradient)
                  ? `linear-gradient(135deg, ${cat.gradient[0]}, ${cat.gradient[1]})`
                  : catTheme.gradient;

                return (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-glass)',
                      flexWrap: isEditing ? 'wrap' : 'nowrap',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* 分类色块图标 */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: gradientStr, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {catTheme.icon || cat.label[0]}
                    </div>

                    {/* 分类名 + 当前维度 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.label}
                      </div>
                      {!isEditing && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {cat.dimension
                            ? <><span style={{ opacity: 0.6 }}>📊</span> {cat.dimension}</>
                            : <span style={{ opacity: 0.4 }}>未设置雷达图维度</span>}
                        </div>
                      )}
                    </div>

                    {/* 编辑按钮 / 内联编辑区 */}
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEditDimension(cat)}
                        title="编辑雷达图维度名称"
                        style={{ background: 'none', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '4px 9px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.78rem', flexShrink: 0, transition: 'border-color 0.15s, color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        ✏️ 维度
                      </button>
                    ) : (
                      <div style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          autoFocus
                          value={dimensionInputs[cat.id] ?? ''}
                          onChange={e => setDimensionInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          placeholder={`${cat.label} 的成长维度，如"动手创造力"`}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveDimension(cat);
                            if (e.key === 'Escape') cancelEditDimension(cat.id);
                          }}
                          style={{ ...INPUT_STYLE, flex: 1, fontSize: '0.83rem', padding: '7px 10px' }}
                        />
                        <button
                          type="button"
                          onClick={() => saveDimension(cat)}
                          disabled={isSaving}
                          style={{ padding: '7px 14px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: isSaving ? 'wait' : 'pointer', fontWeight: '600', fontSize: '0.83rem', whiteSpace: 'nowrap' }}
                        >
                          {isSaving ? '…' : '保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEditDimension(cat.id)}
                          style={{ padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-glass)', cursor: 'pointer', fontSize: '0.83rem' }}
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 右侧：新增分类表单 ── */}
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-secondary)', margin: 0 }}>➕ 新增自定义分类</h4>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>分类名称</label>
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="如：读书"
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ width: '80px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>图标 Emoji</label>
                <input
                  type="text"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  placeholder="📖"
                  style={{ ...INPUT_STYLE, textAlign: 'center' }}
                />
              </div>
            </div>

            {/* 雷达图维度名称（可选） */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                📊 雷达图维度名称
                <span style={{ marginLeft: '6px', opacity: 0.55, fontSize: '0.75rem' }}>（可选，不填则默认使用分类名称）</span>
              </label>
              <input
                type="text"
                value={newCatDimension}
                onChange={(e) => setNewCatDimension(e.target.value)}
                placeholder="如：语言文学素养"
                style={INPUT_STYLE}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>挑选主题配色（渐变色）</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {PRESET_GRADIENTS.map((preset, idx) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setSelectedGradientIdx(idx)}
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                      border: selectedGradientIdx === idx ? '3px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      boxShadow: selectedGradientIdx === idx ? '0 0 10px rgba(0,0,0,0.25)' : 'none',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ marginTop: '10px', height: '44px', minHeight: '44px' }}
            >
              {isSubmitting ? '正在保存...' : '💾 保存新兴趣分类'}
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
