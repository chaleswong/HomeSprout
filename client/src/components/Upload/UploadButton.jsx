import React, { useRef } from 'react';

export default function UploadButton({ icon, label, color, accept, onChange, multiple = false }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onChange?.(multiple ? Array.from(e.target.files) : e.target.files[0]);
      // 重置 value 使得相同文件可以再次触发上传
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
      />
      <button 
        type="button" 
        className="btn btn-large" 
        style={{
          background: color,
          color: 'white',
          border: 'none'
        }}
        onClick={handleClick}
      >
        <span className="btn-icon-large">{icon}</span>
        <span>{label}</span>
      </button>
    </>
  );
}
