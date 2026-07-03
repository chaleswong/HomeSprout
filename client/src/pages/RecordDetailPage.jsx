import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { getCategoryTheme } from '../utils/categoryTheme';
import { useRecordsContext } from '../contexts/RecordsContext';
import CategoryTag from '../components/Category/CategoryTag';
import HighlightBadge from '../components/Highlight/HighlightBadge';

export default function RecordDetailPage() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { toggleHighlight, fetchRecords, fetchStats, categories } = useRecordsContext();
  
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // 音频播放控制
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      const data = await api.getRecord(uuid);
      setRecord(data);
      setEditTitle(data.title);
      setEditSummary(data.summary || '');
      
      // 异步加载该作品底下的所有多媒体附件
      try {
        const filesData = await api.getRecordFiles(uuid);
        if (filesData && filesData.files) {
          const imageFiles = filesData.files.filter(f => {
            if (f === 'thumb.webp') return false; // 排除缩略图文件
            const ext = f.substring(f.lastIndexOf('.')).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(ext);
          });
          imageFiles.sort();
          setMediaFiles(imageFiles);
        }
      } catch (err) {
        console.warn('获取作品附件列表失败:', err);
      }
    } catch (err) {
      console.error('获取作品详情失败:', err);
      alert('作品不存在或已被移动');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [uuid]);

  const handleTitleSubmit = async () => {
    if (!editTitle.trim()) return;
    try {
      await api.updateRecord(uuid, { title: editTitle });
      setRecord(prev => ({ ...prev, title: editTitle }));
      setIsEditingTitle(false);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(err.message || '更新标题失败');
    }
  };

  const handleSummarySubmit = async () => {
    try {
      await api.updateRecord(uuid, { summary: editSummary });
      setRecord(prev => ({ ...prev, summary: editSummary }));
      setIsEditingSummary(false);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(err.message || '更新简介失败');
    }
  };

  const handleAddTag = async (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      const updatedTags = [...(record.tags || []), newTag.trim()];
      try {
        await api.updateRecord(uuid, { tags: updatedTags });
        setRecord(prev => ({ ...prev, tags: updatedTags }));
        setNewTag('');
        fetchRecords();
        fetchStats();
      } catch (err) {
        alert(err.message || '添加标签失败');
      }
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = (record.tags || []).filter(t => t !== tagToRemove);
    try {
      await api.updateRecord(uuid, { tags: updatedTags });
      setRecord(prev => ({ ...prev, tags: updatedTags }));
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(err.message || '移除标签失败');
    }
  };

  const handleDetailStarClick = async () => {
    try {
      const updated = await toggleHighlight(uuid, record.is_highlight);
      if (updated) {
        setRecord(prev => ({ ...prev, is_highlight: updated.is_highlight }));
      }
    } catch (err) {
      // 错误已由 Context 弹出
    }
  };

  const handleCategoryChange = async (newCategory) => {
    try {
      const updatedAiMetadata = { ...record.ai_metadata, primary_category: newCategory };
      await api.updateRecord(uuid, { ai_metadata: updatedAiMetadata });
      setRecord(prev => ({
        ...prev,
        ai_metadata: updatedAiMetadata
      }));
      setShowCategorySelector(false);
      fetchRecords();
      fetchStats();
    } catch (err) {
      alert(err.message || '修改分类失败');
    }
  };

  const handleDeleteRecord = async () => {
    if (window.confirm('确定要删除这个素材吗？该操作会将文件移至回收站，并从时光轴和图谱中移除。')) {
      try {
        await api.deleteRecord(uuid);
        await fetchRecords();
        await fetchStats();
        navigate('/');
      } catch (err) {
        alert(err.message || '删除素材失败');
      }
    }
  };

  // 音频播放控制相关函数
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleProgressBarClick = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div style={{ fontSize: '2rem', animation: 'floatBob 1.5s infinite' }}>🌱</div>
        <div style={{ color: 'var(--text-secondary)' }}>正在打开成长日记...</div>
      </div>
    );
  }

  const { title, date, media_type, original_filename, is_highlight, ai_metadata, tags, body, summary } = record;
  const category = ai_metadata?.primary_category || '未知';
  const theme = getCategoryTheme(category);

  return (
    <div className="record-detail-container">
      
      {/* 顶部返回链接 */}
      <span className="back-link" onClick={() => navigate(-1)}>
        <span>←</span>
        <span>返回</span>
      </span>

      {/* 媒体展现部分 */}
      <div className="detail-media-container">
        
        {media_type === 'image' && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '16px' }}>
            {/* 主图展示 */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={api.getMediaUrl(uuid, mediaFiles.length > 0 ? mediaFiles[activeImageIdx] : original_filename)}
                alt={title}
                className={`detail-image ${zoomed ? 'zoomed' : ''}`}
                onClick={() => setZoomed(!zoomed)}
                style={{ cursor: 'zoom-in', transition: 'all 0.3s ease' }}
              />
              
              {/* 左右滑块导航 */}
              {mediaFiles.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx(prev => (prev === 0 ? mediaFiles.length - 1 : prev - 1))}
                    style={{
                      position: 'absolute',
                      left: '16px',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(15, 15, 35, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.2s',
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx(prev => (prev === mediaFiles.length - 1 ? 0 : prev + 1))}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(15, 15, 35, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.2s',
                    }}
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* 缩略图导航条 */}
            {mediaFiles.length > 1 && (
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  overflowX: 'auto', 
                  padding: '8px 4px', 
                  justifyContent: 'center',
                  width: '100%',
                  scrollbarWidth: 'thin'
                }}
              >
                {mediaFiles.map((filename, idx) => (
                  <div
                    key={filename}
                    onClick={() => setActiveImageIdx(idx)}
                    style={{
                      width: '70px',
                      height: '50px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: activeImageIdx === idx ? `2px solid ${theme.colorStart}` : '1px solid var(--border-glass)',
                      boxShadow: activeImageIdx === idx ? `0 0 8px ${theme.colorStart}80` : 'none',
                      opacity: activeImageIdx === idx ? 1 : 0.6,
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={api.getMediaUrl(uuid, filename)}
                      alt={`Thumbnail ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {media_type === 'video' && (
          <video 
            src={api.getMediaUrl(uuid, original_filename)}
            className="detail-video" 
            controls 
          />
        )}

        {media_type === 'audio' && (
          <div className="detail-audio-player">
            <audio
              ref={audioRef}
              src={api.getMediaUrl(uuid, original_filename)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleAudioEnded}
            />
            
            <div 
              style={{ 
                fontSize: '4.5rem', 
                background: theme.gradient, 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
              }}
            >
              <span>{category === '唱歌' ? '🎤' : '🗣️'}</span>
            </div>

            <div className="audio-controls">
              <button 
                type="button" 
                className="play-pause-btn" 
                style={{ '--accent-gradient': theme.gradient }}
                onClick={togglePlayPause}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              
              <div className="audio-progress-container" onClick={handleProgressBarClick}>
                <div 
                  className="audio-progress-bar" 
                  style={{ 
                    '--accent-gradient': theme.gradient,
                    width: `${duration ? (currentTime / duration) * 100 : 0}%` 
                  }} 
                />
              </div>

              <div className="audio-time-label">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 详情与元数据卡片 */}
      <div className="detail-meta-card glass" style={{ borderLeft: `6px solid ${theme.colorStart}` }}>
        <div className="detail-header">
          <div style={{ flex: 1 }}>
            {isEditingTitle ? (
              <input
                type="text"
                className="detail-title-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                autoFocus
              />
            ) : (
              <h1 
                className="detail-title-input" 
                onClick={() => setIsEditingTitle(true)}
                style={{ cursor: 'pointer', borderBottomColor: 'rgba(255,255,255,0.05)' }}
                title="点击修改作品标题"
              >
                {title || '未命名作品'}
              </h1>
            )}

            <div className="detail-date-row" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>{new Date(date).toLocaleString('zh-CN')}</span>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span 
                  onClick={() => setShowCategorySelector(!showCategorySelector)} 
                  style={{ 
                    cursor: 'pointer', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  title="点击修改作品分类"
                >
                  <CategoryTag category={category} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>⚙️ 修改</span>
                </span>
                
                {showCategorySelector && (
                  <div className="glass-strong" style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    zIndex: 100,
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    minWidth: '150px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>选择新分类：</div>
                    {categories.map(cat => {
                      const catTheme = getCategoryTheme(cat.label);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategoryChange(cat.label)}
                          style={{
                            background: cat.label === category ? catTheme.gradient : 'transparent',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            width: '100%',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={(e) => {
                            if (cat.label !== category) {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (cat.label !== category) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <span>{catTheme.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <HighlightBadge active={is_highlight} onClick={handleDetailStarClick} />
        </div>

        {/* 成长简介 (Summary) */}
        <div style={{ margin: '16px 0', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📝</span>
              <span>成长简介</span>
            </span>
            {!isEditingSummary && (
              <button
                type="button"
                onClick={() => setIsEditingSummary(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', opacity: 0.8 }}
                onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                onMouseOut={(e) => e.currentTarget.style.opacity = 0.8}
              >
                ✏️ 修改
              </button>
            )}
          </div>
          
          {isEditingSummary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '60px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '8px',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: '30px', height: '30px', padding: '0 12px', fontSize: '0.8rem' }}
                  onClick={() => {
                    setEditSummary(record.summary || '');
                    setIsEditingSummary(false);
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minHeight: '30px', height: '30px', padding: '0 12px', fontSize: '0.8rem' }}
                  onClick={handleSummarySubmit}
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5' }}>
              {summary || '这个作品还没有生成成长简介。'}
            </p>
          )}
        </div>

        {/* 标签 */}
        <div className="detail-tags-row">
          <span>标签：</span>
          {(tags || []).map(t => (
            <span className="tag-pill" key={t}>
              <span>{t}</span>
              <button 
                type="button" 
                className="tag-remove-btn"
                onClick={() => handleRemoveTag(t)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="tag-input-pill"
            placeholder="+ 添加新标签"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleAddTag}
          />
        </div>

        {/* 详细描述 */}
        <div className="detail-body">
          {body || '这个成长档案还没有写下描述。可以在这里记录 skye 完成作品时的心情与背景哦 💬'}
        </div>

        {/* AI 自动分类结果元数据框 */}
        <div className="ai-metadata-box">
          <div className="ai-box-title">
            <span>🤖</span>
            <span>本地 AI 智能分析</span>
          </div>
          <div className="ai-box-content">
            <div>大类归宿：{category} (置信度: {(ai_metadata?.confidence * 100).toFixed(0)}%)</div>
            {ai_metadata?.detected_entities && ai_metadata.detected_entities.length > 0 && (
              <div>识别实体：{ai_metadata.detected_entities.join(', ')}</div>
            )}
            {ai_metadata?.ocr_text_hint && (
              <div>OCR 识别线索：{ai_metadata.ocr_text_hint}</div>
            )}
            <div>识别模式：规则分类匹配器 (Phase 1)</div>
          </div>
        </div>

        {/* 危险操作区：删除素材 */}
        <div className="danger-zone" style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
          <button 
            type="button" 
            className="btn" 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.12)', 
              color: '#f87171', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease-in-out',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            onClick={handleDeleteRecord}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
          >
            🗑️ 删除该成长素材
          </button>
        </div>
      </div>

    </div>
  );
}
