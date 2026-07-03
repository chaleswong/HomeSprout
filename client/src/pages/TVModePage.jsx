import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { getCategoryTheme } from '../utils/categoryTheme';

const COLS = 4; // 电视端固定为 4 列网格以确保远距离大图清晰度
const GAMEPAD_POLL_INTERVAL = 100; // 手柄轮询间隔 (ms)
const JOYSTICK_THRESHOLD = 0.5; // 摇杆触发阈值

export default function TVModePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [activeGamepadIndex, setActiveGamepadIndex] = useState(null);

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const gamepadTimerRef = useRef(null);
  const gridContainerRef = useRef(null);

  // 记录最后一次按键/摇杆触发时间，用于防抖/节流
  const lastActionTimeRef = useRef(0);
  const ACTION_COOLDOWN = 250; // 触发冷却时间 (ms)

  // ── 1. 获取全量数据 ──
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await api.getRecords({ limit: 100 });
      setRecords(data.records || []);
    } catch (err) {
      console.error('TV端获取记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // ── 2. 处理聚焦元素滚动可见 ──
  useEffect(() => {
    if (gridContainerRef.current) {
      const activeElement = gridContainerRef.current.querySelector('[data-focused="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [focusedIdx, selectedRecord]);

  // ── 3. 音频自动播放与控制 ──
  useEffect(() => {
    if (selectedRecord && selectedRecord.media_type === 'audio') {
      setIsPlayingAudio(true);
    } else {
      setIsPlayingAudio(false);
    }
  }, [selectedRecord]);

  // ── 4. 2D 网格聚焦跳转逻辑 ──
  const moveFocus = useCallback((dir) => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < ACTION_COOLDOWN) return;
    lastActionTimeRef.current = now;

    setRecords((currentRecords) => {
      const len = currentRecords.length;
      if (len === 0) return currentRecords;

      setFocusedIdx((prevIdx) => {
        let nextIdx = prevIdx;
        if (dir === 'left') {
          nextIdx = prevIdx > 0 ? prevIdx - 1 : len - 1;
        } else if (dir === 'right') {
          nextIdx = prevIdx < len - 1 ? prevIdx + 1 : 0;
        } else if (dir === 'up') {
          nextIdx = prevIdx - COLS >= 0 ? prevIdx - COLS : prevIdx;
        } else if (dir === 'down') {
          nextIdx = prevIdx + COLS < len ? prevIdx + COLS : prevIdx;
        }
        return nextIdx;
      });
      return currentRecords;
    });
  }, []);

  // ── 5. A/B 键确认与退出逻辑 ──
  const handleConfirm = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < ACTION_COOLDOWN) return;
    lastActionTimeRef.current = now;

    if (selectedRecord) {
      // 详情页打开状态下，A 键控制音视频播放/暂停
      if (selectedRecord.media_type === 'audio' && audioRef.current) {
        if (isPlayingAudio) {
          audioRef.current.pause();
          setIsPlayingAudio(false);
        } else {
          audioRef.current.play().catch(console.error);
          setIsPlayingAudio(true);
        }
      } else if (selectedRecord.media_type === 'video' && videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.error);
        } else {
          videoRef.current.pause();
        }
      }
    } else {
      // 列表状态下，A 键确认进入详情页
      if (records[focusedIdx]) {
        setSelectedRecord(records[focusedIdx]);
      }
    }
  }, [records, focusedIdx, selectedRecord, isPlayingAudio]);

  const handleCancel = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < ACTION_COOLDOWN) return;
    lastActionTimeRef.current = now;

    if (selectedRecord) {
      // 详情页退回列表
      setSelectedRecord(null);
    }
  }, [selectedRecord]);

  // ── 6. 摇杆手柄 API (Gamepad API) 轮询 ──
  const pollGamepad = useCallback(() => {
    if (activeGamepadIndex === null) return;
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[activeGamepadIndex];
    if (!gamepad) return;

    // 摇杆控制 (Axis 0 = 左右摇杆, Axis 1 = 上下摇杆)
    const axisX = gamepad.axes[0];
    const axisY = gamepad.axes[1];

    if (axisX < -JOYSTICK_THRESHOLD) {
      moveFocus('left');
    } else if (axisX > JOYSTICK_THRESHOLD) {
      moveFocus('right');
    } else if (axisY < -JOYSTICK_THRESHOLD) {
      moveFocus('up');
    } else if (axisY > JOYSTICK_THRESHOLD) {
      moveFocus('down');
    }

    // 常用实体按键映射 (Button 0: A/Cross 确认, Button 1: B/Circle 取消)
    const buttonA = gamepad.buttons[0];
    const buttonB = gamepad.buttons[1];

    if (buttonA && (buttonA.pressed || buttonA.value > 0.5)) {
      handleConfirm();
    } else if (buttonB && (buttonB.pressed || buttonB.value > 0.5)) {
      handleCancel();
    }
  }, [activeGamepadIndex, moveFocus, handleConfirm, handleCancel]);

  useEffect(() => {
    const handleGamepadConnected = (e) => {
      console.log('🎮 [Gamepad] 检测到手柄连接:', e.gamepad.id);
      setGamepadConnected(true);
      setActiveGamepadIndex(e.gamepad.index);
    };

    const handleGamepadDisconnected = (e) => {
      console.log('🎮 [Gamepad] 手柄断开:', e.gamepad.id);
      setGamepadConnected(false);
      setActiveGamepadIndex(null);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // 启动定时轮询器
    gamepadTimerRef.current = setInterval(pollGamepad, GAMEPAD_POLL_INTERVAL);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (gamepadTimerRef.current) clearInterval(gamepadTimerRef.current);
    };
  }, [pollGamepad]);

  // ── 7. 键盘备用交互（方便无手柄调试和测试） ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        moveFocus('left');
      } else if (e.key === 'ArrowRight') {
        moveFocus('right');
      } else if (e.key === 'ArrowUp') {
        moveFocus('up');
      } else if (e.key === 'ArrowDown') {
        moveFocus('down');
      } else if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveFocus, handleConfirm, handleCancel]);

  // ── 8. 渲染与布局 ──
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', backgroundColor: '#070714', color: '#fff', gap: '20px' }}>
        <div style={{ fontSize: '4rem', animation: 'floatBob 1.5s infinite' }}>📺</div>
        <h2 style={{ fontWeight: '700', letterSpacing: '2px' }}>正在构建电视大屏沙发交互系统...</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#070714',
        color: '#fff',
        padding: '30px 50px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: 'Noto Sans SC, sans-serif',
      }}
    >
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '2.2rem' }}>🌱</span>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '1px', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              HomeSprout 电视大屏影院
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              使用电视遥控器 / 游戏手柄进行沙发交互
            </p>
          </div>
        </div>

        {/* 手柄连接状态提示 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            padding: '8px 16px',
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.85rem',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: gamepadConnected ? '#10b981' : '#f59e0b',
              boxShadow: gamepadConnected ? '0 0 8px #10b981' : 'none',
            }}
          />
          <span>{gamepadConnected ? '🎮 蓝牙手柄已连接' : '⌨️ 手柄未连接，支持方向键+Enter控制'}</span>
        </div>
      </div>

      {/* 核心作品网格区 */}
      <div
        ref={gridContainerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: '24px',
          height: 'calc(100vh - 160px)',
          overflowY: 'auto',
          padding: '10px',
          boxSizing: 'border-box',
        }}
      >
        {records.map((item, idx) => {
          const catTheme = getCategoryTheme(item.category);
          const isFocused = idx === focusedIdx && !selectedRecord;
          const bgTint = isFocused
            ? `rgba(${catTheme.colorRGB || '99,102,241'}, 0.15)`
            : 'rgba(255, 255, 255, 0.03)';
          const borderGlow = isFocused
            ? `3px solid ${catTheme.colorStart || '#6366f1'}`
            : '2px solid rgba(255, 255, 255, 0.06)';
          const textShadow = isFocused ? '0 0 8px rgba(255,255,255,0.5)' : 'none';

          return (
            <div
              key={item.uuid}
              data-focused={isFocused}
              onClick={() => {
                setFocusedIdx(idx);
                setSelectedRecord(item);
              }}
              style={{
                backgroundColor: bgTint,
                border: borderGlow,
                borderRadius: '16px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)',
                transform: isFocused ? 'scale(1.05) translateY(-6px)' : 'scale(1)',
                boxShadow: isFocused
                  ? `0 12px 30px rgba(${catTheme.colorRGB || '99,102,241'}, 0.4)`
                  : '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                height: '320px',
              }}
            >
              {/* 卡片缩略图或媒体占位符 */}
              <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}>
                {item.media_type === 'image' ? (
                  <img
                    src={api.getMediaUrl(item.uuid, 'thumb.webp')}
                    alt={item.title}
                    onError={(e) => {
                      e.target.src = api.getMediaUrl(item.uuid, item.original_filename);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3.5rem',
                      background: `linear-gradient(135deg, ${catTheme.colorStart}50, ${catTheme.colorEnd}30)`,
                    }}
                  >
                    {item.media_type === 'video' ? '🎬' : '🎤'}
                  </div>
                )}

                {/* 分类小标签 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: `linear-gradient(135deg, ${catTheme.colorStart}, ${catTheme.colorEnd})`,
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                  }}
                >
                  {catTheme.icon} {item.category}
                </div>
              </div>

              {/* 作品文字信息 */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#fff',
                    textShadow,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                  {item.date}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 详情页大屏全屏 Overlay ── */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 5, 12, 0.95)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 80px',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.25s ease-out',
            fontFamily: 'Noto Sans SC, sans-serif',
          }}
        >
          {/* 大屏影院媒体容器 */}
          <div
            style={{
              width: '80%',
              maxWidth: '1200px',
              height: '60%',
              backgroundColor: '#000',
              borderRadius: '24px',
              border: '4px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selectedRecord.media_type === 'image' && (
              <img
                src={api.getMediaUrl(selectedRecord.uuid, selectedRecord.original_filename)}
                alt={selectedRecord.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}

            {selectedRecord.media_type === 'video' && (
              <video
                ref={videoRef}
                src={api.getMediaUrl(selectedRecord.uuid, selectedRecord.original_filename)}
                controls
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}

            {selectedRecord.media_type === 'audio' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '24px',
                  width: '100%',
                  height: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #111827, #1f2937)',
                }}
              >
                <audio
                  ref={audioRef}
                  src={api.getMediaUrl(selectedRecord.uuid, selectedRecord.original_filename)}
                  autoPlay
                  loop
                  onPlay={() => setIsPlayingAudio(true)}
                  onPause={() => setIsPlayingAudio(false)}
                />
                
                {/* 炫酷大屏音频声波视觉效果 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '120px' }}>
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        borderRadius: '4px',
                        background: 'linear-gradient(to top, #38bdf8, #818cf8)',
                        height: isPlayingAudio ? '100%' : '10%',
                        animation: isPlayingAudio
                          ? `ripple 1.${(i % 5) + 2}s ease-in-out infinite alternate`
                          : 'none',
                        transformOrigin: 'bottom',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: '1.2rem', color: '#38bdf8', fontWeight: 'bold' }}>
                  {isPlayingAudio ? '正在大厅环绕播放朗诵音频...' : '音频播放已暂停'}
                </div>
              </div>
            )}
          </div>

          {/* 文字信息及 AI 成长小评 */}
          <div
            style={{
              width: '80%',
              maxWidth: '1200px',
              marginTop: '32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>
              {selectedRecord.title}
            </h2>
            <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.45)' }}>
              {selectedRecord.date} | 分类：{selectedRecord.category}
            </div>
            
            <p
              style={{
                fontSize: '1.3rem',
                lineHeight: '1.7',
                color: 'rgba(255,255,255,0.85)',
                margin: '12px auto 0 auto',
                maxWidth: '900px',
                background: 'rgba(255,255,255,0.03)',
                padding: '20px 30px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              🌱 AI 描述：{selectedRecord.ai_metadata?.description || selectedRecord.description || '暂无详细描述，快去在后台生成吧！'}
            </p>
          </div>

          {/* 底部手柄实体按键导航提示 */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              gap: '30px',
            }}
          >
            {selectedRecord.media_type !== 'image' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>A</span>
                <span>{isPlayingAudio ? '暂停' : '播放'}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>B</span>
              <span>返回列表</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
