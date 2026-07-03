import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

// ─── 纯 SVG 雷达图组件 ───────────────────────────────────────────────
function RadarChart({ data, size = 320 }) {
  if (!data || data.length < 3) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌱</div>
        <div>再投喂 3 种不同类型的作品，雷达图就会出现啦！</div>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 48;
  const n = data.length;
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // 计算每个顶点的坐标
  const angleOf = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointAt = (i, r) => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy + r * Math.sin(angleOf(i)),
  });

  // 背景同心多边形（5 层）
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const gridPolygons = gridLevels.map((frac) => {
    const pts = data.map((_, i) => {
      const p = pointAt(i, maxRadius * frac);
      return `${p.x},${p.y}`;
    });
    return pts.join(' ');
  });

  // 数据多边形
  const dataPoints = data.map((d, i) => {
    const ratio = Math.min(d.count / maxCount, 1);
    const r = maxRadius * ratio;
    const p = pointAt(i, r);
    return `${p.x},${p.y}`;
  });

  // 提取所有渐变中的第一个颜色用于混合
  const blendColor = data[0]?.gradient?.[0] || '#6366f1';

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: 'visible', maxWidth: '100%' }}
    >
      <defs>
        <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={blendColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={data[Math.floor(n / 2)]?.gradient?.[0] || '#a855f7'} stopOpacity="0.25" />
        </linearGradient>
        <filter id="radarGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 背景网格线 */}
      {data.map((_, i) => {
        const outer = pointAt(i, maxRadius);
        return (
          <line
            key={`axis-${i}`}
            x1={cx} y1={cy}
            x2={outer.x} y2={outer.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        );
      })}

      {/* 同心多边形 */}
      {gridPolygons.map((pts, li) => (
        <polygon
          key={`grid-${li}`}
          points={pts}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={li === gridPolygons.length - 1 ? 1.5 : 1}
        />
      ))}

      {/* 数据填充多边形 */}
      <polygon
        points={dataPoints.join(' ')}
        fill="url(#radarFill)"
        stroke={blendColor}
        strokeWidth="2"
        filter="url(#radarGlow)"
        style={{
          animation: 'radarExpand 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />

      {/* 数据点 */}
      {data.map((d, i) => {
        const ratio = Math.min(d.count / maxCount, 1);
        const p = pointAt(i, maxRadius * ratio);
        const color = d.gradient?.[0] || '#6366f1';
        return (
          <circle
            key={`dot-${i}`}
            cx={p.x} cy={p.y}
            r="5"
            fill={color}
            stroke="white"
            strokeWidth="2"
            filter="url(#radarGlow)"
          />
        );
      })}

      {/* 维度标签 */}
      {data.map((d, i) => {
        const p = pointAt(i, maxRadius + 28);
        const isLeft = p.x < cx - 5;
        const isRight = p.x > cx + 5;
        const anchor = isLeft ? 'end' : isRight ? 'start' : 'middle';
        const color = d.gradient?.[0] || '#94a3b8';
        // 多个分类合并时，副标题显示各分类名称
        const sublabel = d.labels && d.labels.length > 1
          ? d.labels.join(' + ')
          : `${d.count} 件`;
        return (
          <g key={`label-${i}`}>
            <text
              x={p.x}
              y={p.y - 4}
              textAnchor={anchor}
              fill={color}
              fontSize="12"
              fontWeight="700"
              fontFamily="inherit"
            >
              {d.dimension}
            </text>
            <text
              x={p.x}
              y={p.y + 12}
              textAnchor={anchor}
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="inherit"
            >
              {sublabel}
            </text>
            {/* 合并时显示件数 */}
            {d.labels && d.labels.length > 1 && (
              <text
                x={p.x}
                y={p.y + 24}
                textAnchor={anchor}
                fill="var(--text-muted)"
                fontSize="9"
                fontFamily="inherit"
                opacity="0.7"
              >
                {d.count} 件
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── 里程碑徽章卡片 ───────────────────────────────────────────────────
function MilestoneCard({ milestone }) {
  const { label, dimension, icon, gradient, count, badges } = milestone;
  const gradientStr = `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`;
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div
      className="glass"
      style={{
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景装饰光效 */}
      {unlockedCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: gradient[0],
            opacity: 0.06,
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 分类标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: gradientStr,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}
        >
          {icon || label[0]}
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{dimension !== label ? dimension : label}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {dimension !== label && `（${label}）`}共 {count} 件作品
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {unlockedCount}/{badges.length} 已解锁
        </div>
      </div>

      {/* 徽章列表 */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-around' }}>
        {badges.map((badge) => (
          <div
            key={badge.level}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              flex: 1,
              filter: badge.unlocked ? 'none' : 'grayscale(1) opacity(0.35)',
              transition: 'filter 0.3s ease',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: badge.unlocked ? gradientStr : 'var(--bg-secondary)',
                border: badge.unlocked ? `2px solid ${gradient[0]}` : '2px solid var(--border-glass)',
                boxShadow: badge.unlocked ? `0 0 14px ${gradient[0]}60` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                position: 'relative',
                animation: badge.unlocked ? 'badgePulse 3s ease-in-out infinite' : 'none',
              }}
            >
              {badge.unlocked ? badge.emoji : '🔒'}
              {badge.unlocked && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '-3px',
                    borderRadius: '50%',
                    background: `conic-gradient(${gradient[0]}, ${gradient[1]}, ${gradient[0]})`,
                    zIndex: -1,
                    opacity: 0.5,
                    animation: 'spin 4s linear infinite',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: badge.unlocked ? gradient[0] : 'var(--text-muted)' }}>
              {badge.level}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
              {badge.unlocked ? badge.label : `${badge.threshold} 件解锁`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getDashboard();
      setData(result);
    } catch (err) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '3rem', animation: 'floatBob 1.5s infinite' }}>📊</div>
        <div style={{ color: 'var(--text-secondary)' }}>正在生成成长看板...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <div style={{ color: 'var(--text-secondary)' }}>{error}</div>
        <button type="button" className="btn btn-primary" onClick={fetchDashboard}>重试</button>
      </div>
    );
  }

  const { radarData = [], milestones = [], totalWorks = 0, totalHighlights = 0, activeDays = 0 } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '24px' }}>

      {/* 页面标题 */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '6px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🌱 Skye 的成长看板
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>记录每一次创造，见证每一步成长</p>
      </div>

      {/* 顶部统计摘要 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[
          { label: '总作品数', value: totalWorks, icon: '🎨', color: '#6366f1' },
          { label: '高光素材', value: totalHighlights, icon: '⭐', color: '#f59e0b' },
          { label: '活跃天数', value: activeDays, icon: '📅', color: '#10b981' },
        ].map((s) => (
          <div
            key={s.label}
            className="glass"
            style={{
              padding: '16px 12px',
              borderRadius: '14px',
              textAlign: 'center',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '1.6rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 成长维度雷达图 */}
      <div className="glass" style={{ padding: '28px 20px', borderRadius: '20px', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🕸️</span><span>成长维度雷达图</span>
        </h2>
        <RadarChart data={radarData} size={300} />
        {radarData.length >= 3 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            越宽广的多边形代表越均衡的全才发展 ✨
          </p>
        )}
      </div>

      {/* 成就里程碑区 */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏆</span><span>成就里程碑</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '400', marginLeft: '4px' }}>
            每 5 / 10 / 20 件作品解锁一枚徽章
          </span>
        </h2>
        {milestones.length === 0 ? (
          <div className="glass" style={{ padding: '32px', textAlign: 'center', borderRadius: '16px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🌟</div>
            开始投喂作品，里程碑徽章就会出现！
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {milestones.map((m) => (
              <MilestoneCard key={m.categoryId} milestone={m} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
