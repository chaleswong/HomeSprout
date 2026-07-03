import React, { useState, useRef, useEffect } from 'react';

export default function AudioRecorder({ onComplete }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        const file = new File([audioBlob], `recording_${Date.now()}.${options.mimeType.includes('mp4') ? 'm4a' : 'webm'}`, {
          type: audioBlob.type
        });
        onComplete?.(file);
        
        // 停止所有音频轨道以释放麦克风权限
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecording(true);
      setSeconds(0);
      
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('麦克风连接或录音失败:', err);
      alert('请检查是否已授权麦克风访问权限');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder-container glass">
      <button 
        type="button" 
        className={`record-mic-btn ${recording ? 'recording' : ''}`}
        onClick={toggleRecording}
      >
        <div className="pulse-ring" />
        <span>{recording ? '⏹️' : '🎤'}</span>
      </button>
      
      <div className="record-timer" style={{ color: recording ? '#f43f5e' : 'inherit' }}>
        {recording ? `正在录音... ${formatTime(seconds)}` : '点击开始说两句'}
      </div>
      
      {recording && (
        <div 
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            animation: 'fadeIn 1s infinite alternate'
          }}
        >
          点击上方按钮结束录制并上传
        </div>
      )}
    </div>
  );
}
