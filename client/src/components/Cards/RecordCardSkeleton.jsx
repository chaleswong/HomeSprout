import React from 'react';

export default function RecordCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div 
        style={{
          width: '100%',
          aspectRatio: '4/3',
          background: 'rgba(255, 255, 255, 0.03)',
        }}
      />
      <div 
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Title loader */}
        <div 
          style={{
            height: '18px',
            width: '80%',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px'
          }}
        />
        <div 
          style={{
            height: '14px',
            width: '40%',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '4px'
          }}
        />
        
        {/* Footer loader */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            alignItems: 'center'
          }}
        >
          <div 
            style={{
              height: '24px',
              width: '60px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px'
            }}
          />
          <div 
            style={{
              height: '12px',
              width: '40px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px'
            }}
          />
        </div>
      </div>
    </div>
  );
}
