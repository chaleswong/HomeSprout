import React from 'react';
import { getCategoryTheme } from '../../utils/categoryTheme';

export default function CategoryTag({ category }) {
  const theme = getCategoryTheme(category);
  
  return (
    <span 
      className="category-tag" 
      style={{
        background: theme.gradient,
        padding: '4px 10px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        borderRadius: '6px',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      <span>{theme.icon}</span>
      <span>{theme.label}</span>
    </span>
  );
}
