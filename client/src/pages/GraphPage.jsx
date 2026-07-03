import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cytoscape from 'cytoscape';
import { api } from '../utils/api';
import { useRecordsContext } from '../contexts/RecordsContext';
import { getCategoryTheme } from '../utils/categoryTheme';
import CategoryTag from '../components/Category/CategoryTag';

export default function GraphPage() {
  const { records } = useRecordsContext();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // 过滤控制状态
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [showHighlightsOnly, setShowHighlightsOnly] = useState(false);
  const [enableTagGravity, setEnableTagGravity] = useState(false);

  // 1. 初始化拉取后端图谱数据
  const fetchGraph = async () => {
    try {
      setLoading(true);
      const data = await api.getGraphData();
      setGraphData(data);
    } catch (err) {
      console.error('获取思维图谱失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // 2. 预置力导向布局参数，生成有机的“知识网萌芽生长”动画
  const layoutConfig = {
    name: 'cose',
    animate: true,
    animationDuration: 800,
    randomize: false,
    fit: true,
    padding: 50,
    nodeOverlap: 20,
    refresh: 20,
    componentSpacing: 120,
    nodeRepulsion: () => 120000,
    idealEdgeLength: () => 80,
    edgeElasticity: () => 100,
    nestingFactor: 1.2,
    gravity: 1.5,
    numIter: 1000,
    initialTemp: 1000,
    coolingFactor: 0.99,
    minTemp: 1.0
  };

  // 3. 构造 Cytoscape 渲染实例
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // 清毁已有实例防泄漏
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const { nodes, edges } = graphData.elements;

    // 复制节点和边防突变
    const elementsToRender = [
      ...nodes.map(n => ({ ...n })),
      ...edges.map(e => ({ ...e }))
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements: elementsToRender,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)', // 动态绑定 AI 提取的主色调
            'width': 'mapData(degree, 0, 8, 28, 60)', // 根据出度+入度动态映射尺寸
            'height': 'mapData(degree, 0, 8, 28, 60)',
            'color': 'var(--text-primary)',
            'font-size': '11px',
            'font-family': 'Inter, Noto Sans SC, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'overlay-opacity': 0,
            'border-width': '2px',
            'border-color': 'var(--border-glass)',
            'transition-property': 'background-color, width, height, border-color, opacity',
            'transition-duration': '0.25s'
          }
        },
        {
          selector: 'node[isHighlight = "true"]',
          style: {
            'border-width': '4px',
            'border-color': '#FFD700', // 高光里程碑节点，金边外围
            'border-opacity': 0.95
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#ffffff',
            'border-width': '4px'
          }
        },
        {
          selector: 'node.filtered-out',
          style: {
            'opacity': 0.15,
            'events': 'no' // 禁用点击穿透
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': 'var(--border-glass)',
            'target-arrow-shape': 'none',
            'curve-style': 'bezier',
            'overlay-opacity': 0,
            'transition-property': 'opacity',
            'transition-duration': '0.25s'
          }
        },
        {
          selector: 'edge[source][target]',
          style: {
            'width': 2.5,
            'line-color': '#6366f1', // 有向双链使用紫色实线
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#6366f1'
          }
        },
        {
          selector: 'edge.implicit',
          style: {
            'width': 1.2,
            'line-color': 'rgba(156,163,175,0.25)', // 标签类聚弱连接使用淡灰虚线
            'line-style': 'dashed',
            'target-arrow-shape': 'none',
            'curve-style': 'haystack'
          }
        },
        {
          selector: 'edge.filtered-out',
          style: {
            'opacity': 0.04
          }
        }
      ],
      layout: layoutConfig
    });

    cyRef.current = cy;

    // --- 事件监听 ---
    // 点击选择节点
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const uuid = node.id();
      const r = records.find(rec => rec.uuid === uuid);
      if (r) {
        setSelectedNode(r);
      }
    });

    // 点击空白处取消选择
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    // 鼠标悬停显示大图预览和详情卡片
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const data = node.data();
      const pos = node.renderedPosition();
      
      setHoveredNode({
        data,
        x: pos.x,
        y: pos.y
      });
    });

    cy.on('mouseout', 'node', () => {
      setHoveredNode(null);
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graphData, records]);

  // 4. 高级过滤交互逻辑：增删类名以防 Cytoscape 全局重绘导致的卡顿
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !graphData) return;

    cy.startBatch();

    const nodes = cy.nodes();
    const edges = cy.edges();

    // 首先清空过滤样式
    nodes.removeClass('filtered-out');
    edges.removeClass('filtered-out');

    let hasFilter = false;

    // 4.1 按主分类过滤
    if (categoryFilter !== '全部') {
      hasFilter = true;
      nodes.forEach(n => {
        if (n.data('category') !== categoryFilter) {
          n.addClass('filtered-out');
        }
      });
    }

    // 4.2 只看高光节点过滤
    if (showHighlightsOnly) {
      hasFilter = true;
      nodes.forEach(n => {
        if (n.data('isHighlight') !== 'true') {
          n.addClass('filtered-out');
        }
      });
    }

    // 4.3 如果应用了过滤，隐蔽关联边以保持图谱洁净度
    if (hasFilter) {
      edges.forEach(e => {
        const source = cy.getElementById(e.data('source'));
        const target = cy.getElementById(e.data('target'));
        if (source.hasClass('filtered-out') || target.hasClass('filtered-out')) {
          e.addClass('filtered-out');
        }
      });
    }

    cy.endBatch();
  }, [categoryFilter, showHighlightsOnly, graphData]);

  // 5. 标签引力（隐式类聚）动态连线逻辑
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !graphData) return;

    if (enableTagGravity) {
      // 开启隐式连接：找出共享标签且时间接近 (14天内) 的节点
      const implicitEdges = [];
      const nodesData = graphData.elements.nodes;

      for (let i = 0; i < nodesData.length; i++) {
        const r1 = records.find(rec => rec.uuid === nodesData[i].data.id);
        if (!r1 || !r1.tags || r1.tags.length === 0) continue;

        for (let j = i + 1; j < nodesData.length; j++) {
          const r2 = records.find(rec => rec.uuid === nodesData[j].data.id);
          if (!r2 || !r2.tags || r2.tags.length === 0) continue;

          // 检查共享标签
          const hasCommonTag = r1.tags.some(t => r2.tags.includes(t));
          if (!hasCommonTag) continue;

          // 检查时间差（14天内）
          const diffTime = Math.abs(new Date(r1.date) - new Date(r2.date));
          const diffDays = diffTime / (1000 * 60 * 60 * 24);

          if (diffDays <= 14) {
            const edgeId = `implicit-${r1.uuid}-${r2.uuid}`;
            // 防止跟已有的双链实线或隐式虚线冲突
            if (!cy.getElementById(edgeId).length && !cy.getElementById(`edge-${r1.uuid}-${r2.uuid}`).length) {
              implicitEdges.push({
                data: {
                  id: edgeId,
                  source: r1.uuid,
                  target: r2.uuid,
                  type: 'implicit'
                },
                classes: 'implicit'
              });
            }
          }
        }
      }

      if (implicitEdges.length > 0) {
        cy.add(implicitEdges);
        // 重新启动力导向物理引擎进行重新排版聚集
        cy.layout(layoutConfig).run();
      }
    } else {
      // 关闭隐式连接：移出所有 implicit 虚线边并复原布局
      const implicitCollection = cy.edges('.implicit');
      if (implicitCollection.length > 0) {
        cy.remove(implicitCollection);
        cy.layout(layoutConfig).run();
      }
    }
  }, [enableTagGravity, graphData, records]);

  // 控制组件辅助函数
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() + 0.15);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() - 0.15);
  const handleFit = () => cyRef.current?.fit();

  // 提取当前所有可用的分类过滤标签
  const availableCategories = graphData
    ? ['全部', ...new Set(graphData.elements.nodes.map(n => n.data.category))]
    : ['全部'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', height: 'calc(100vh - 120px)' }}>
      
      {/* 顶部标题及统计 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🧠</span>
          <span>思维与技能成长图谱</span>
        </h2>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          出入度代表作品间的关联密度，节点越大，说明 Skye 在该领域的创作越丰富和深入 ✨
        </div>
      </div>

      {/* 图谱主容器 */}
      <div className="graph-container glass" style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: '400px' }}>
        {loading ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            正在加载认知网络拓扑图... ⌛
          </div>
        ) : !graphData || graphData.elements.nodes.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            没有发现足够的作品双链关联，快去在作品中用 [[名字]] 建立链接吧！🎨
          </div>
        ) : (
          <>
            {/* 画布 */}
            <div ref={containerRef} className="graph-canvas" style={{ width: '100%', height: '100%' }} />

            {/* 控制器与高级过滤栏面板 (半透明玻璃拟态) */}
            <div className="graph-toolbar glass-strong" style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              padding: '12px',
              borderRadius: '12px',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '0.9rem'
            }}>
              {/* 左侧：分类过滤 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '600' }}>领域过滤:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {availableCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`btn ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        minHeight: '32px',
                        height: '32px',
                        padding: '0 12px',
                        fontSize: '0.8rem',
                        borderRadius: '16px'
                      }}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 中间：开关控制项 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showHighlightsOnly}
                    onChange={(e) => setShowHighlightsOnly(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span>⭐ 只看高光</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }} title="共享标签且14天内创作的节点产生引力线并自动靠拢聚簇">
                  <input
                    type="checkbox"
                    checked={enableTagGravity}
                    onChange={(e) => setEnableTagGravity(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span>🔌 开启标签引力</span>
                </label>
              </div>

              {/* 右侧：画布操作 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ width: '36px', height: '36px', minWidth: '36px', padding: '0', borderRadius: '50%' }} onClick={handleZoomIn} title="放大">➕</button>
                <button type="button" className="btn btn-secondary" style={{ width: '36px', height: '36px', minWidth: '36px', padding: '0', borderRadius: '50%' }} onClick={handleZoomOut} title="缩小">➖</button>
                <button type="button" className="btn btn-secondary" style={{ width: '36px', height: '36px', minWidth: '36px', padding: '0', borderRadius: '50%' }} onClick={handleFit} title="全局自适应">🎯</button>
              </div>
            </div>

            {/* 鼠标 hover 悬停节点即时弹窗预览面板 */}
            {hoveredNode && (
              <div style={{
                position: 'absolute',
                left: `${hoveredNode.x + 15}px`,
                top: `${hoveredNode.y - 120}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 100,
                width: hoveredNode.data.cover ? '200px' : '160px',
                borderRadius: '12px',
                pointerEvents: 'none',
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out'
              }} className="glass-strong">
                {hoveredNode.data.cover && (
                  <div style={{ width: '100%', height: '100px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                    <img
                      src={hoveredNode.data.cover}
                      alt="封面"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ padding: '8px 12px', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', lineBreak: 'anywhere', color: 'var(--text-primary)' }}>
                    {hoveredNode.data.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: hoveredNode.data.color,
                      color: '#fff',
                      fontSize: '0.7rem'
                    }}>{hoveredNode.data.category}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>度数: {hoveredNode.data.degree}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 选中节点详情侧栏 (右侧飞入) */}
            {selectedNode && (
              <div className="graph-sidebar glass-strong" style={{
                borderLeft: `5px solid ${getCategoryTheme(selectedNode.ai_metadata?.primary_category).colorStart}`,
                position: 'absolute',
                top: '90px',
                right: '12px',
                bottom: '12px',
                width: '320px',
                zIndex: 15,
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-glow)',
                animation: 'slideInRight 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, textAlign: 'left', flex: 1, paddingRight: '8px' }}>
                    {selectedNode.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{new Date(selectedNode.date).toLocaleDateString('zh-CN')}</span>
                  {selectedNode.is_highlight && <span style={{ color: '#FFD700' }}>⭐ 高光时刻</span>}
                </div>

                <div style={{ textAlign: 'left' }}>
                  <CategoryTag category={selectedNode.ai_metadata?.primary_category} />
                </div>

                {selectedNode.media_type === 'image' && (
                  <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                    <img
                      src={`/api/records/${selectedNode.uuid}/media/${selectedNode.original_filename}`}
                      alt="封面"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}

                <div style={{
                  fontSize: '0.9rem',
                  flex: 1,
                  overflowY: 'auto',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '12px',
                  textAlign: 'left',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5'
                }}>
                  {selectedNode.body ? (
                    selectedNode.body.length > 200
                      ? `${selectedNode.body.slice(0, 200)}...`
                      : selectedNode.body
                  ) : '无详细描述'}
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary"
                  style={{ width: '100%', minHeight: '44px', height: '44px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => navigate(`/record/${selectedNode.uuid}`)}
                >
                  查看完整作品档案 ➔
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
