import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { getCategoryTheme } from '../../utils/categoryTheme';
import { useRecordsContext } from '../../contexts/RecordsContext';
import CategoryTag from '../Category/CategoryTag';
import HighlightBadge from '../Highlight/HighlightBadge';

export default function RecordCard({ record, index }) {
  const navigate = useNavigate();
  const { toggleHighlight } = useRecordsContext();
  const { uuid, title, date, media_type, original_filename, is_highlight, ai_metadata } = record;
  
  const category = ai_metadata?.primary_category || '未知';
  const theme = getCategoryTheme(category);
  const dominantColor = ai_metadata?.visual_thumbnail_dominant_color || '#64748B';

  const handleClick = () => {
    navigate(`/record/${uuid}`);
  };

  const handleStarClick = (e) => {
    e.stopPropagation();
    toggleHighlight(uuid);
  };

  const formattedDate = React.useMemo(() => {
    if (!date) return '';
    try {
      const d = new Date(date);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    } catch {
      return '';
    }
  }, [date]);

  // 根据主色调计算卡片背景微透明度
  const cardStyle = {
    '--accent-gradient': theme.gradient,
    backgroundColor: `rgba(${theme.colorRGB}, 0.04)`,
    borderColor: is_highlight ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255,255,255,0.08)',
    animationDelay: `${index * 50}ms`
  };

  // 生成媒体渲染内容
  const renderMedia = () => {
    if (media_type === 'image') {
      const thumbUrl = api.getMediaUrl(uuid, 'thumb.webp');
      const fallbackUrl = api.getMediaUrl(uuid, original_filename);
      return (
        <img 
          src={thumbUrl} 
          alt={title} 
          className="card-media"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = fallbackUrl;
          }}
        />
      );
    }

    // 视频和音频用Emoji卡片占位，体现精美艺术感
    let emoji = '🧱';
    if (media_type === 'video') emoji = '🎬';
    if (media_type === 'audio') {
      emoji = category === '唱歌' ? '🎤' : '🗣️';
    }

    return (
      <div 
        className="media-placeholder-icon" 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.gradient,
          fontSize: '3.5rem',
          color: '#fff'
        }}
      >
        <span>{emoji}</span>
      </div>
    );
  };

  return (
    <div 
      className={`record-card glass ${is_highlight ? 'highlighted' : ''}`} 
      style={cardStyle}
      onClick={handleClick}
    >
      {/* 右上角高光星星 */}
      <HighlightBadge active={is_highlight} onClick={handleStarClick} />

      {/* 媒体封面 */}
      <div className="card-media-wrapper">
        {renderMedia()}
      </div>

      {/* 文字详情 */}
      <div className="card-body">
        <h3 className="card-title">{title || '未命名作品'}</h3>
        
        <div className="card-meta">
          <CategoryTag category={category} />
          <span className="card-date">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
