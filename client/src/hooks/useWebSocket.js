import { useEffect, useRef, useState, useCallback } from 'react';

const isDemoMode = 
  window.location.hostname.endsWith('github.io') || 
  window.location.search.includes('demo=true') ||
  window.location.hostname === 'localhost' && window.location.search.includes('mock=true');

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (isDemoMode) {
      console.log('[WS] Demo 模式下跳过 WebSocket 连接');
      return;
    }

    const wsUrl = `ws://${window.location.hostname}:3001`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[WS] 已连接到后端实时推送服务器');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (err) {
          console.error('[WS] 接收到的消息解析失败:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] 连接已断开，5秒后重试...');
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error('[WS] 错误:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WS] 初始化连接失败:', err);
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected };
}
