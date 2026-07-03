import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useRecordsContext } from '../../contexts/RecordsContext';
import { getCategoryTheme } from '../../utils/categoryTheme';

export default function AppShell({ children }) {
  const { connected, notification, theme, setTheme } = useRecordsContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNotificationClick = () => {
    if (notification?.data?.uuid) {
      navigate(`/record/${notification.data.uuid}`);
    }
  };

  const getNotificationTheme = () => {
    if (!notification?.data?.category) return {};
    const theme = getCategoryTheme(notification.data.category);
    return {
      background: `rgba(${theme.colorRGB || '99,102,241'}, 0.15)`,
      borderLeft: `5px solid ${theme.colorStart || '#6366f1'}`,
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    };
  };

  return (
    <div className="app-shell">
      {/* 顶部导航栏 */}
      <header className="nav-bar">
        <div className="nav-brand" onClick={() => navigate('/')}>
          <span>🌱</span>
          <span>HomeSprout</span>
        </div>

        {/* 桌面端导航 */}
        <nav className="nav-links">
          <NavLink to="/" className="nav-link" end>时光轴 🕐</NavLink>
          <NavLink to="/gallery" className="nav-link">画廊 🎨</NavLink>
          <NavLink to="/graph" className="nav-link">图谱 🧠</NavLink>
          <NavLink to="/upload" className="nav-link">投喂 📸</NavLink>
          <NavLink to="/export" className="nav-link">作品集 📄</NavLink>
          <NavLink to="/dashboard" className="nav-link">成长看板 📊</NavLink>
          <NavLink to="/tv" className="nav-link">电视大屏 📺</NavLink>
          <NavLink to="/admin" className="nav-link">后台 ⚙️</NavLink>
        </nav>

        {/* 顶部状态与功能区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 主题快速切换 */}
          <button 
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="theme-toggle-btn"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              color: 'var(--text-primary)',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
            }}
            title={theme === 'light' ? '切换为暗色模式' : '切换为浅色模式'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* 局域网连接状态指示 */}
          <div className="status-indicator">
            <span className={`status-dot ${connected ? 'connected' : ''}`}></span>
            <span>{connected ? '局域网在线' : '正在连接后端...'}</span>
          </div>
        </div>
      </header>

      {/* 实时新上传弹窗通知 (Toast) */}
      {notification && (
        <div 
          className="toast-notification" 
          style={getNotificationTheme()}
          onClick={handleNotificationClick}
        >
          <span className="toast-icon">
            {getCategoryTheme(notification.data.category).icon}
          </span>
          <div className="toast-content">
            <div className="toast-title">发现新作品投喂！</div>
            <div className="toast-desc">
              刚刚捕获了："{notification.data.title}"，AI 自动归类为「{notification.data.category}」
            </div>
          </div>
        </div>
      )}

      {/* 页面主要内容 */}
      <main className="main-content">
        {children}
      </main>

      {/* 移动端底部标签栏 (Tab Bar) */}
      <nav className="tab-bar">
        <NavLink to="/" className="tab-item">
          <span className="tab-icon">🕐</span>
          <span>时光轴</span>
        </NavLink>
        
        <NavLink to="/gallery" className="tab-item">
          <span className="tab-icon">🎨</span>
          <span>画廊</span>
        </NavLink>

        <NavLink to="/upload" className="tab-item feed-center">
          <div className="tab-icon-wrap">
            <span className="tab-icon">📸</span>
          </div>
          <span style={{ marginTop: '-8px' }}>投喂</span>
        </NavLink>

        <NavLink to="/graph" className="tab-item">
          <span className="tab-icon">🧠</span>
          <span>思维图谱</span>
        </NavLink>

        <NavLink to="/export" className="tab-item">
          <span className="tab-icon">📄</span>
          <span>作品集</span>
        </NavLink>

        <NavLink to="/dashboard" className="tab-item">
          <span className="tab-icon">📊</span>
          <span>成长看板</span>
        </NavLink>
      </nav>
    </div>
  );
}
