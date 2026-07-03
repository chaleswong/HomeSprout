import React, { useState, useEffect } from 'react';
import { useRecordsContext } from '../contexts/RecordsContext';
import { getAllCategories } from '../utils/categoryTheme';
import RecordCard from '../components/Cards/RecordCard';
import RecordCardSkeleton from '../components/Cards/RecordCardSkeleton';

export default function GalleryPage() {
  const { records, loading, categories: contextCategories } = useRecordsContext();
  const [activeCategory, setActiveCategory] = useState('全部');
  const [filteredRecords, setFilteredRecords] = useState([]);

  const categories = ['全部', ...(contextCategories || []).map(c => c.label).filter(l => l !== '未知')];

  useEffect(() => {
    if (activeCategory === '全部') {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(records.filter(r => r.ai_metadata?.primary_category === activeCategory));
    }
  }, [records, activeCategory]);

  const isEmpty = filteredRecords.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 标题 */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🎨</span>
        <span>作品大画廊</span>
      </h2>

      {/* 顶部分类过滤器 */}
      <div className="filter-bar">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 瀑布流展示 */}
      {loading ? (
        <div className="gallery-masonry">
          <RecordCardSkeleton />
          <RecordCardSkeleton />
          <RecordCardSkeleton />
        </div>
      ) : isEmpty ? (
        <div className="empty-state glass">
          <div className="empty-state-icon">🎨</div>
          <div className="empty-state-title">没有找到相关作品</div>
          <div className="empty-state-desc">
            在「{activeCategory}」分类下还没有任何作品记录哦。
          </div>
        </div>
      ) : (
        <div className="gallery-masonry">
          {filteredRecords.map((record, index) => (
            <RecordCard
              key={record.uuid}
              record={record}
              index={index}
            />
          ))}
        </div>
      )}

    </div>
  );
}
