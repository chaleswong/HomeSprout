import React, { useEffect, useState } from 'react';
import { useRecordsContext } from '../contexts/RecordsContext';
import { api } from '../utils/api';
import RecordCard from '../components/Cards/RecordCard';
import RecordCardSkeleton from '../components/Cards/RecordCardSkeleton';
import { useNavigate } from 'react-router-dom';

export default function TimelinePage() {
  const { stats, loading: contextLoading } = useRecordsContext();
  const [timeline, setTimeline] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const data = await api.getTimeline();
      setTimeline(data || {});
    } catch (err) {
      console.error('获取时光轴数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [stats]); // 当统计变化（新记录或高光切换）时，重新获取时光轴

  // 将月度 key (如 "2026-06") 格式化为中文 (如 "2026年6月")
  const formatMonthKey = (key) => {
    const [year, month] = key.split('-');
    return `${year}年${parseInt(month)}月`;
  };

  const isTimelineEmpty = Object.keys(timeline).length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 顶部三栏统计概览 */}
      <div className="stats-summary-bar">
        <div className="stat-card glass">
          <div className="stat-value">{stats?.total || 0}</div>
          <div className="stat-label">全部作品 📦</div>
        </div>
        <div className="stat-card glass" style={{ borderColor: 'rgba(234,179,8,0.2)' }}>
          <div className="stat-value" style={{ color: '#eab308' }}>{stats?.highlights || 0}</div>
          <div className="stat-label">高光时刻 ⭐</div>
        </div>
        <div className="stat-card glass" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
          <div className="stat-value" style={{ color: '#818cf8' }}>{stats?.weeklyNew || 0}</div>
          <div className="stat-label">本周新增 🌱</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🕐</span>
          <span>成长历史线</span>
        </h2>

        {loading || contextLoading ? (
          <div className="timeline-container">
            <div className="timeline-group">
              <div className="timeline-header">
                <span className="timeline-dot" />
                <div style={{ height: '24px', width: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
              </div>
              <div className="timeline-grid">
                <RecordCardSkeleton />
                <RecordCardSkeleton />
              </div>
            </div>
          </div>
        ) : isTimelineEmpty ? (
          <div className="empty-state glass">
            <div className="empty-state-icon">🌱</div>
            <div className="empty-state-title">还没有归档的作品哦</div>
            <div className="empty-state-desc">
              快去用平板拍照、录视频或者录音，上传 skye 的第一个成长闪光瞬间吧！
            </div>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => navigate('/upload')}
              style={{ marginTop: '8px' }}
            >
              去投喂作品 📸
            </button>
          </div>
        ) : (
          <div className="timeline-container">
            {Object.entries(timeline)
              .sort((a, b) => b[0].localeCompare(a[0])) // 按年月逆序排列
              .map(([monthKey, items]) => (
                <div className="timeline-group" key={monthKey}>
                  <div className="timeline-header">
                    <span className="timeline-dot" />
                    <span>{formatMonthKey(monthKey)}</span>
                    <span className="timeline-month-count">{items.length}个作品</span>
                  </div>
                  
                  <div className="timeline-grid">
                    {items.map((item, idx) => (
                      <RecordCard 
                        key={item.uuid} 
                        record={item} 
                        index={idx}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

    </div>
  );
}
