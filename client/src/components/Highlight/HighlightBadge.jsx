import React from 'react';

export default function HighlightBadge({ active, onClick }) {
  return (
    <button 
      type="button"
      className={`highlight-badge ${active ? 'active' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      aria-label={active ? "取消高光" : "标记高光"}
      style={{
        border: 'none',
        outline: 'none',
        background: active ? '#eab308' : 'rgba(15, 15, 35, 0.65)',
        color: active ? '#fff' : '#94a3b8',
        boxShadow: active ? '0 0 12px rgba(234, 179, 8, 0.4)' : 'none'
      }}
    >
      {active ? '⭐' : '☆'}
    </button>
  );
}
