import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import UploadButton from '../components/Upload/UploadButton';
import AudioRecorder from '../components/Upload/AudioRecorder';

export default function UploadPage() {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [customTitle, setCustomTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);

  const handleSelectFile = (files) => {
    if (!files) return;
    const fileList = Array.isArray(files) ? files : [files];
    if (fileList.length === 0) return;
    
    setSelectedFiles(fileList);
    
    // 默认取第一个文件不带扩展名的文件名
    const firstFile = fileList[0];
    const nameWithoutExt = firstFile.name ? firstFile.name.substring(0, firstFile.name.lastIndexOf('.')) : '';
    if (nameWithoutExt.startsWith('recording_')) {
      setCustomTitle('我的语音记录');
    } else {
      setCustomTitle(nameWithoutExt);
    }
  };

  const handleConfirmUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      setUploading(true);
      setProgressText('正在将作品保存到本地档案库...');
      
      const firstFile = selectedFiles[0];
      const isImage = firstFile.type.startsWith('image/');
      
      if (isImage) {
        // 图片类支持多张组合为单个作品记录
        await api.uploadFiles(selectedFiles, customTitle.trim());
      } else {
        // 视频和音频维持单文件独立上传
        await api.uploadFile(firstFile, customTitle.trim());
      }
      
      setUploading(false);
      setSuccess(true);
      setSelectedFiles([]);
      setCustomTitle('');
      
      // 2.5秒后自动跳回首页 timeline
      setTimeout(() => {
        navigate('/');
      }, 2500);
    } catch (err) {
      console.error('上传失败:', err);
      alert(err.message || '归档保存失败，请检查局域网连接');
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '60vh', justifyContent: 'center' }}>
      
      {success ? (
        <div className="upload-success-overlay glass" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="success-check">🎉</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#10b981' }}>上传保存成功！</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            本地 AI 正在解析归类你的作品... 马上带你去看！
          </p>
        </div>
      ) : uploading ? (
        <div className="upload-success-overlay glass" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
          <div className="success-check" style={{ animation: 'floatBob 2s infinite' }}>⏳</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>正在保存作品...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{progressText}</p>
        </div>
      ) : selectedFiles.length > 0 ? (
        /* 作品命名与确认面板 */
        <div className="upload-success-overlay glass" style={{ borderColor: 'rgba(99,102,241,0.3)', padding: '24px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <span>✨</span>
            <span>大功告成！给作品起个名字：</span>
          </h2>
          
          {/* 媒体预览 */}
          <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', minHeight: '180px', padding: '10px', position: 'relative' }}>
            {selectedFiles.length > 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '5px 0', width: '100%', scrollbarWidth: 'thin' }}>
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} style={{ width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-glass)' }}>
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={`预览 ${idx + 1}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  📸 已选择 {selectedFiles.length} 张图片组合上传为单条档案
                </div>
              </div>
            ) : selectedFiles.length === 1 ? (
              selectedFiles[0].type.startsWith('image/') ? (
                <img 
                  src={URL.createObjectURL(selectedFiles[0])} 
                  alt="预览" 
                  style={{ width: '100%', maxHeight: '250px', objectFit: 'contain' }} 
                />
              ) : selectedFiles[0].type.startsWith('video/') ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '3rem' }}>🎬</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>视频作品: {selectedFiles[0].name}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '3rem' }}>🎤</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>语音记录: {selectedFiles[0].name}</span>
                </div>
              )
            ) : null}
          </div>

          {/* 输入框 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: '24px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>作品名字 🏷️</label>
            <input
              type="text"
              className="export-input"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="例：我搭的超级大飞船 / Skye唱小燕子 🚀"
              style={{ width: '100%', padding: '12px', fontSize: '1.05rem' }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmUpload();
                }
              }}
            />
          </div>

          {/* 操作按钮组 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedFiles([]);
                setCustomTitle('');
              }}
              style={{ width: '100%' }}
            >
              返回修改 ↩️
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmUpload}
              style={{ width: '100%' }}
            >
              放入成长树 🚀
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Skye 欢迎引导 */}
          <div className="upload-welcome">
            <h1>嘿 skye！今天创作了什么？🎨</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.1rem' }}>
              点击下方的大按钮，把你的大作丢进成长树中吧！
            </p>
          </div>

          {/* 投喂大按钮网格 */}
          <div className="upload-grid">
            <UploadButton
              icon="📸"
              label="拍个照 / 选多图"
              color="linear-gradient(135deg, #ff6b35, #ff8e53)"
              accept="image/*"
              multiple={true}
              onChange={handleSelectFile}
            />

            <UploadButton
              icon="🎬"
              label="选视频"
              color="linear-gradient(135deg, #0ea5e9, #38bdf8)"
              accept="video/*"
              onChange={handleSelectFile}
            />

            <button
              type="button"
              className="btn btn-large"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                color: 'white',
                border: 'none'
              }}
              onClick={() => setShowAudioRecorder(!showAudioRecorder)}
            >
              <span className="btn-icon-large">🎤</span>
              <span>{showAudioRecorder ? '收起录音机' : '说两句 / 唱歌'}</span>
            </button>
          </div>

          {/* 录音组件容器 */}
          {showAudioRecorder && (
            <div style={{ maxWidth: '480px', width: '100%', margin: '16px auto 0 auto', animation: 'scaleUp 0.3s ease' }}>
              <AudioRecorder onComplete={handleSelectFile} />
            </div>
          )}
        </>
      )}

    </div>
  );
}
