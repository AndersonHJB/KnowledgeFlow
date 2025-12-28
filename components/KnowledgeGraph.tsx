
import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { KnowledgeNode, NodeStatus } from '../types';
import { Star, LayoutGrid, Zap, Plus, Minus, Maximize, RotateCcw, MousePointer2 } from 'lucide-react';

interface KnowledgeGraphProps {
  topic: string;
  nodes: KnowledgeNode[];
  onNodeClick: (node: KnowledgeNode) => void;
  currentLevel: number;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ topic, nodes, onNodeClick, currentLevel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const [zoom, setZoom] = useState(1);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<{ d: string; active: boolean; id: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Recursive Tree Data Preparation (Right-to-Left logic)
  const treeData = useMemo(() => {
    const root = nodes.find(n => n.type === 'root');
    if (!root) return null;

    const buildTree = (parentId: string) => {
      return nodes
        .filter(n => n.parentId === parentId)
        .map(n => ({
          ...n,
          children: buildTree(n.id)
        }));
    };

    return {
      ...root,
      children: buildTree(root.id)
    };
  }, [nodes]);

  // High-Precision SVG Path Calculation
  const updateLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: { d: string; active: boolean; id: string }[] = [];

    nodes.forEach(node => {
      const parentId = node.parentId;
      if (!parentId) return;

      const startEl = nodeRefs.current[node.id];
      const endEl = nodeRefs.current[parentId];

      // Only draw if both nodes are visible in the DOM (not collapsed)
      if (startEl && endEl && startEl.offsetParent !== null && endEl.offsetParent !== null) {
        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();

        // Right side of child (Task/Branch) connects to Left side of parent (Branch/Root)
        // We use the exact center-right of the child and center-left of the parent
        const startX = (startRect.right - containerRect.left) / zoom;
        const startY = (startRect.top + startRect.height / 2 - containerRect.top) / zoom;
        
        const endX = (endRect.left - containerRect.left) / zoom;
        const endY = (endRect.top + endRect.height / 2 - containerRect.top) / zoom;

        // Smooth cubic bezier with horizontal control points
        const distance = Math.abs(endX - startX);
        const horizontalOffset = distance * 0.5;
        const d = `M ${startX} ${startY} C ${startX + horizontalOffset} ${startY}, ${endX - horizontalOffset} ${endY}, ${endX} ${endY}`;
        
        newLines.push({ 
          d, 
          active: node.status !== NodeStatus.LOCKED, 
          id: `${node.id}-${parentId}` 
        });
      }
    });

    setLines(newLines);
  };

  // Sync lines whenever the state that affects layout changes
  useLayoutEffect(() => {
    const timer = setTimeout(updateLines, 50);
    window.addEventListener('resize', updateLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateLines);
    };
  }, [nodes, zoom, collapsedBranches]);

  // Initial scroll position to the center-right (near the root)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 1000;
      scrollRef.current.scrollTop = 500;
    }
  }, []);

  const toggleBranch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedBranches(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.4), 1.8));
  };

  const resetView = () => {
    setZoom(1);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 1000, top: 500, behavior: 'smooth' });
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.pageX - scrollRef.current.offsetLeft,
      y: e.pageY - scrollRef.current.offsetTop,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const y = e.pageY - scrollRef.current.offsetTop;
    const walkX = (x - dragStart.x) * 1.5;
    const walkY = (y - dragStart.y) * 1.5;
    scrollRef.current.scrollLeft = dragStart.scrollLeft - walkX;
    scrollRef.current.scrollTop = dragStart.scrollTop - walkY;
  };

  if (!treeData) return null;

  return (
    <div className="flex flex-col h-full bg-[#fcfdfe] relative overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 md:px-8 py-5 flex justify-between items-center z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LayoutGrid size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 leading-tight tracking-tight">{topic}</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-0.5">Mind Map Explorer</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden lg:flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
             <MousePointer2 size={12} className="text-gray-300" /> 按住空格或鼠标拖拽地图
           </div>
           <div className="px-5 py-2 bg-orange-50 text-orange-600 text-xs font-black rounded-full border border-orange-100 shadow-sm">
             目标：STAGE {currentLevel}
           </div>
        </div>
      </div>

      {/* Infinite Canvas */}
      <div 
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        className={`flex-1 overflow-auto relative cursor-${isDragging ? 'grabbing' : 'grab'} bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] transition-all scroll-smooth selection-none`}
      >
        <div 
          ref={containerRef}
          className="min-w-[4000px] min-h-[3000px] flex items-center justify-center relative origin-center"
          style={{ 
            transform: `scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* SVG Connection Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
            <defs>
              <filter id="active-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {lines.map((line) => (
              <path 
                key={line.id}
                d={line.d} 
                fill="none" 
                stroke={line.active ? '#fb923c' : '#f1f5f9'} 
                strokeWidth={line.active ? "4" : "2.5"}
                strokeLinecap="round"
                className="transition-all duration-700 ease-in-out"
                style={line.active ? { filter: 'url(#active-line-glow)' } : {}}
              />
            ))}
          </svg>

          {/* Root-to-Leaf Layout (Right-to-Left Visual) */}
          <div className="flex items-center gap-32 md:gap-48 relative z-10 flex-row-reverse pr-[500px]">
            
            {/* Root Hub (Right side) */}
            <div ref={el => { nodeRefs.current[treeData.id] = el; }} className="relative shrink-0">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-[12px] border-white bg-gradient-to-br from-[#ffb443] to-[#ff6b00] flex flex-col items-center justify-center shadow-[0_40px_100px_-20px_rgba(255,107,0,0.5)] text-white relative select-none">
                <span className="text-xs md:text-sm font-black uppercase tracking-[0.5em] opacity-80 mb-2">Level</span>
                <span className="text-9xl md:text-[11rem] font-black tracking-tighter leading-none">{currentLevel}</span>
                {/* Decorative Elements */}
                <div className="absolute inset-[-20px] rounded-full border-2 border-dashed border-orange-200/30 animate-[spin_30s_linear_infinite]" />
                <div className="absolute inset-[-40px] rounded-full border-[1px] border-orange-200/10 animate-[spin_60s_linear_infinite_reverse]" />
                {/* Anchor point */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full border-4 border-orange-400 shadow-lg" />
              </div>
            </div>

            {/* Branches Container */}
            <div className="flex flex-col gap-32 md:gap-40">
              {treeData.children.map((branch: any) => (
                <div key={branch.id} className="flex flex-row-reverse items-center gap-24 md:gap-32">
                  
                  {/* Branch Node (Middle) */}
                  <div className="relative shrink-0">
                    <div 
                      ref={el => { nodeRefs.current[branch.id] = el; }}
                      className={`
                        px-12 py-7 rounded-[3rem] border-[5px] min-w-[220px] text-center font-black text-2xl md:text-3xl transition-all duration-500 relative
                        ${branch.status === NodeStatus.COMPLETED ? 'bg-white border-orange-200 text-orange-600 shadow-2xl' : 'bg-white border-gray-100 text-gray-200 shadow-sm'}
                      `}
                    >
                      {branch.label}
                      {/* Anchor points */}
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-[4px] border-orange-200 shadow-inner" />
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-[4px] border-orange-200 shadow-inner" />
                    </div>
                    {/* Expand/Collapse Toggle Button */}
                    <button 
                      onClick={(e) => toggleBranch(branch.id, e)}
                      className="absolute -left-10 top-1/2 -translate-y-1/2 w-9 h-9 bg-white rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:scale-110 shadow-lg transition-all z-20 group"
                    >
                      {collapsedBranches.has(branch.id) ? <Plus size={18} strokeWidth={3} /> : <Minus size={18} strokeWidth={3} />}
                    </button>
                  </div>

                  {/* Task Nodes (Left side) */}
                  {!collapsedBranches.has(branch.id) && (
                    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-10 duration-500 ease-out">
                      {branch.children.map((leaf: any) => {
                        const isActive = leaf.status === NodeStatus.AVAILABLE;
                        const isDone = leaf.status === NodeStatus.COMPLETED;
                        const isLocked = leaf.status === NodeStatus.LOCKED;

                        return (
                          <div 
                            key={leaf.id} 
                            ref={el => { nodeRefs.current[leaf.id] = el; }}
                            className="flex items-center gap-6"
                          >
                            {/* Star Rating for progress */}
                            <div className="flex flex-col gap-1.5 shrink-0 items-end">
                              {[1, 2, 3].map(s => (
                                <Star 
                                  key={s} 
                                  size={13} 
                                  className={leaf.stars >= s ? 'text-yellow-400 fill-yellow-400' : 'text-gray-100'} 
                                />
                              ))}
                            </div>
                            
                            <button
                              disabled={isLocked}
                              onClick={() => onNodeClick(leaf)}
                              className={`
                                p-6 rounded-[2.5rem] border-[4px] text-left min-w-[260px] max-w-[320px] transition-all duration-300 relative group
                                ${isActive ? 'bg-orange-500 border-orange-600 text-white shadow-[0_20px_50px_-10px_rgba(249,115,22,0.6)] scale-110 z-20 ring-8 ring-orange-50 active-node' : ''}
                                ${isDone ? 'bg-white border-green-100 text-gray-800 hover:border-green-300 shadow-sm' : ''}
                                ${isLocked ? 'bg-[#fcfdfe] border-gray-50 text-gray-200 opacity-60 cursor-not-allowed grayscale' : ''}
                                ${!isActive && !isDone && !isLocked ? 'bg-white border-gray-100 hover:border-blue-200' : ''}
                              `}
                            >
                              <h4 className="font-black text-xl leading-tight tracking-tight">{leaf.label}</h4>
                              <p className={`text-xs mt-1.5 font-bold line-clamp-1 ${isActive ? 'text-orange-100' : isLocked ? 'text-gray-100' : 'text-gray-400'}`}>
                                {leaf.description || '解锁探索更多知识点'}
                              </p>
                              
                              {isActive && (
                                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl border-[3px] border-white animate-bounce ring-4 ring-blue-50">
                                  <Zap size={18} fill="white" className="text-white" />
                                </div>
                              )}
                              
                              {/* Connector Anchor point */}
                              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-[3px] border-orange-200 shadow-inner group-hover:scale-125 transition-transform" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Floating Control Panel */}
      <div className="fixed right-8 bottom-10 flex flex-col gap-4 z-40">
        <div className="p-3 bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/50 flex flex-col gap-3 scale-110">
          <button 
            onClick={() => handleZoom(0.15)} 
            className="p-3 hover:bg-blue-50 hover:text-blue-600 rounded-3xl text-gray-500 transition-all active:scale-90"
            title="放大"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
          <button 
            onClick={() => handleZoom(-0.15)} 
            className="p-3 hover:bg-blue-50 hover:text-blue-600 rounded-3xl text-gray-500 transition-all active:scale-90"
            title="缩小"
          >
            <Minus size={24} strokeWidth={3} />
          </button>
          <div className="h-px bg-gray-100 mx-3" />
          <button 
            onClick={resetView} 
            className="p-3 hover:bg-blue-50 hover:text-blue-600 rounded-3xl text-gray-500 transition-all active:scale-90"
            title="重置视图"
          >
            <Maximize size={24} strokeWidth={3} />
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="p-3 hover:bg-red-50 hover:text-red-500 rounded-3xl text-gray-400 transition-all active:scale-90"
            title="重置进度"
          >
            <RotateCcw size={22} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Interactive Helper Footer */}
      <div className="fixed left-8 bottom-10 z-40 hidden md:block">
        <div className="px-8 py-5 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl flex items-center gap-4 transition-all hover:translate-y-[-4px] group">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:rotate-12 transition-transform">
            <LayoutGrid size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-black tracking-wide">点击 <span className="text-orange-400">蓝色闪电</span> 开启闯关</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">挑战关卡以解锁更高阶知识</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
