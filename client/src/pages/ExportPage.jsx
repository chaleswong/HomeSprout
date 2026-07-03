import React, { useState } from 'react';
import { useRecordsContext } from '../contexts/RecordsContext';
import { api } from '../utils/api';
import CategoryTag from '../components/Category/CategoryTag';

export default function ExportPage() {
  const { records } = useRecordsContext();
  const [selectedUuids, setSelectedUuids] = useState([]);
  const [documentTitle, setDocumentTitle] = useState('skye 的成长作品集与升学档案');
  const [exportEngine, setExportEngine] = useState('typst'); // 'typst' 或 'html'
  const [userPrompt, setUserPrompt] = useState('温暖鼓励，肯定孩子的探索精神和多元智能发育');
  const [exporting, setExporting] = useState(false);
  const [stepStatus, setStepStatus] = useState('');
  const [progress, setProgress] = useState(0);

  // 仅筛选高光作品作为待选池
  const highlightRecords = records.filter(r => r.is_highlight);

  const handleToggleSelect = (uuid) => {
    setSelectedUuids(prev => 
      prev.includes(uuid) 
        ? prev.filter(id => id !== uuid) 
        : [...prev, uuid]
    );
  };

  const handleSelectAll = () => {
    if (selectedUuids.length === highlightRecords.length) {
      setSelectedUuids([]);
    } else {
      setSelectedUuids(highlightRecords.map(r => r.uuid));
    }
  };

  const handleExport = async () => {
    if (selectedUuids.length === 0) {
      alert('请先选择至少一个高光作品');
      return;
    }
    
    try {
      setExporting(true);
      const token = localStorage.getItem('homesprout_admin_token');

      if (exportEngine === 'html') {
        // 浏览器 A4 Paged Media 导出逻辑
        const response = await fetch('/api/export/html', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uuids: selectedUuids,
            title: documentTitle
          })
        });

        if (!response.ok) {
          throw new Error('生成网页打印预览失败');
        }

        const htmlContent = await response.text();
        
        // 在新标签页中打开打印页面，并触发原生打印对话框
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          
          // 给图片加载预留时间，然后触发打印
          printWindow.onload = () => {
            printWindow.print();
          };
        } else {
          alert('弹出窗口被阻止，请允许此网站弹出新窗口');
        }
      } else {
        // Typst AI 智能报告书编译逻辑 (异步任务轮询)
        setStepStatus('正在初始化编译任务...');
        setProgress(10);
        
        const response = await fetch('/api/export/typst', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uuids: selectedUuids,
            title: documentTitle,
            userPrompt: userPrompt
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'AI 简历编译启动失败');
        }

        const { jobId } = await response.json();

        // 开始轮询任务状态
        await new Promise((resolve, reject) => {
          const intervalId = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/export/status/${jobId}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (!statusRes.ok) {
                clearInterval(intervalId);
                reject(new Error('获取编译状态失败'));
                return;
              }

              const job = await statusRes.json();
              setStepStatus(job.step);
              setProgress(job.progress);

              if (job.status === 'completed') {
                clearInterval(intervalId);
                
                // 一键自动触发浏览器静默下载
                const downloadUrl = `/api/export/download/${job.result.pdfFilename}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', job.result.pdfFilename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setTimeout(() => {
                  alert('🎉 您的 A4 PDF 作品集已编译完成并下载成功！');
                  resolve();
                }, 800);
              } else if (job.status === 'failed') {
                clearInterval(intervalId);
                reject(new Error(job.error || '后台编译失败'));
              }
            } catch (err) {
              clearInterval(intervalId);
              reject(err);
            }
          }, 2000);
        });
      }
    } catch (err) {
      console.error('导出失败:', err);
      alert(err.message || '导出失败，请重试');
    } finally {
      setExporting(false);
      setStepStatus('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 标题 */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📄</span>
        <span>升学作品集一键编译</span>
      </h2>

      {highlightRecords.length === 0 ? (
        <div className="empty-state glass">
          <div className="empty-state-icon">⭐</div>
          <div className="empty-state-title">还没有标记高光作品</div>
          <div className="empty-state-desc">
            作品集编译只能选用被标记为「高光时刻 ⭐」的作品。请前往作品详情页勾选它们。
          </div>
        </div>
      ) : (
        <div className="export-workspace">
          
          {/* 左侧作品选择器列表 */}
          <div className="export-source-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                可选高光作品 ({highlightRecords.length})：
              </span>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ minHeight: '32px', padding: '0 12px', fontSize: '0.8rem' }}
                onClick={handleSelectAll}
              >
                {selectedUuids.length === highlightRecords.length ? '取消全选' : '全选'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {highlightRecords.map(record => (
                <div 
                  className={`export-item-row ${selectedUuids.includes(record.uuid) ? 'active' : ''}`} 
                  key={record.uuid}
                  onClick={() => handleToggleSelect(record.uuid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: selectedUuids.includes(record.uuid) ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                    border: selectedUuids.includes(record.uuid) ? '1px solid var(--text-muted)' : '1px solid var(--border-glass)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    className="export-checkbox"
                    checked={selectedUuids.includes(record.uuid)}
                    onChange={() => {}} // 捕获外层 row 点击
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  
                  <div className="export-item-details" style={{ flex: 1 }}>
                    <div className="export-item-title" style={{ fontWeight: '500', fontSize: '0.95rem' }}>{record.title}</div>
                    <div className="export-item-meta" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>{new Date(record.date).toLocaleDateString('zh-CN')}</span>
                      <CategoryTag category={record.ai_metadata?.primary_category} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧简历编译设置 */}
          <div className="export-summary-panel glass">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '15px' }}>作品集设置</h3>
            
            <div className="export-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>文档标题</label>
              <input
                type="text"
                className="export-input"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '8px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            {/* 排版引擎选择 */}
            <div className="export-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>排版排版引擎</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="exportEngine"
                    value="typst"
                    checked={exportEngine === 'typst'}
                    onChange={() => setExportEngine('typst')}
                  />
                  <span>AI 智能编译 (Typst PDF)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="radio"
                    name="exportEngine"
                    value="html"
                    checked={exportEngine === 'html'}
                    onChange={() => setExportEngine('html')}
                  />
                  <span>网页打印 (HTML)</span>
                </label>
              </div>
            </div>

            {/* AI 寄语定制 */}
            {exportEngine === 'typst' && (
              <div className="export-form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AI 寄语定制（口吻与侧重点）</label>
                <textarea
                  className="export-input"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '8px',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="例如：用温暖的口吻，侧重表现 Skye 的逻辑思维能力以及对科学探索的好奇心。"
                />
              </div>
            )}

            <div className="export-stats-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '15px 0', padding: '10px 0', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
              <div className="export-stat-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>选定作品数</span>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedUuids.length} 个</span>
              </div>
              <div className="export-stat-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>文档规格</span>
                <span style={{ color: 'var(--text-primary)' }}>A4 标准 (彩色排版)</span>
              </div>
              <div className="export-stat-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>渲染引擎</span>
                <span style={{ color: 'var(--text-primary)' }}>{exportEngine === 'typst' ? 'Typst 0.12 (A4编译)' : 'CSS Paged Media (P1)'}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '15px' }}>
              {exportEngine === 'typst' 
                ? '💡 AI 智能编译在后台调用本地大模型进行分析排版，耗时约 60-90 秒，编译完成后将自动触发 PDF 文件下载。'
                : '💡 网页打印会拉起浏览器原生打印面板。建议勾选「打印背景图形」并设置纸张为 A4 纸以呈现高保真效果。'}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting 
                ? (exportEngine === 'typst' ? '正在智能编译报告书...' : '正在生成打印预览...') 
                : (exportEngine === 'typst' ? '🚀 开始编译 PDF' : '🖨️ 生成网页打印')}
            </button>

            {/* AI 导出状态步骤指示 */}
            {exporting && exportEngine === 'typst' && (
              <div className="glass-strong" style={{
                marginTop: '15px',
                padding: '12px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.85rem',
                border: '1px solid var(--border-glass)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ animation: 'floatBob 1.5s infinite', display: 'inline-block' }}>🤖</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{stepStatus}</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '4px',
                  background: 'var(--bg-card)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #4FACFE 0%, #00F2FE 100%)',
                    transition: 'all 0.5s ease-in-out'
                  }} />
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
