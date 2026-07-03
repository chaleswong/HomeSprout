import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 注册 PWA Service Worker 支持离线缓存和直接桌面安装
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('🌱 [PWA] Service Worker 注册成功，作用域为:', reg.scope);
      })
      .catch((err) => {
        console.error('❌ [PWA] Service Worker 注册失败:', err);
      });
  });
}
