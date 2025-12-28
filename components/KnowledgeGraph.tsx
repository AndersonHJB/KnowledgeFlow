
import React, { useState, useMemo } from 'react';
import { KnowledgeNode, NodeStatus } from '../types';
import { Star, Lock, PlayCircle, CheckCircle2, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';

interface KnowledgeGraphProps {
  topic: string;
  nodes: KnowledgeNode[];
  onNodeClick: (node: KnowledgeNode) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ topic, nodes, onNodeClick }) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Build tree structure
  const tree = useMemo(() => {
    const map: Record<string, { node: KnowledgeNode, children: string[] }> = {};
    nodes.forEach(n => {
      map[n.id] = { node: n, children: [] };
    });
    nodes.forEach(n => {
      if (n.parentId && map[n.parentId]) {
        map[n.parentId].children.push(n.id);
      }
    });
    const roots = nodes.filter(n => !n.parentId || !map[n.parentId]);
    return { map, roots };
  }, [nodes]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (nodeId: string, depth: number = 0) => {
    const item = tree.map[nodeId];
    if (!item) return null;
    const { node, children } = item;
    const isCollapsed = collapsedNodes.has(nodeId);
    const hasChildren = children.length > 0;

    const isLocked = node.status === NodeStatus.LOCKED;
    const isCompleted = node.status === NodeStatus.COMPLETED;
    const isAvailable = node.status === NodeStatus.AVAILABLE;

    return (
      <div key={nodeId} className="flex flex-col">
        <div className="flex items-center gap-4 relative">
          {/* Connector Line for depth */}
          {depth > 0 && (
            <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 w-6 h-0.5 bg-blue-100" />
          )}
          
          <div className="relative group w-full max-w-md">
            <button
              disabled={isLocked}
              onClick={() => onNodeClick(node)}
              className={`
                w-full relative z-10 p-4 md:p-5 rounded-3xl transition-all duration-300 text-left flex items-start gap-4 border-2
                ${isLocked ? 'bg-gray-50 border-gray-100 opacity-60 grayscale cursor-not-allowed' : ''}
                ${isAvailable ? 'bg-white border-blue-500 shadow-xl shadow-blue-100 active-node scale-[1.02]' : ''}
                ${isCompleted ? 'bg-blue-50 border-blue-200' : ''}
                ${!isLocked && !isAvailable && !isCompleted ? 'bg-white border-gray-200' : ''}
              `}
            >
              {/* Status Icon */}
              <div className={`
                p-2.5 rounded-2xl shrink-0
                ${isLocked ? 'bg-gray-200 text-gray-400' : ''}
                ${isAvailable ? 'bg-blue-600 text-white' : ''}
                ${isCompleted ? 'bg-green-100 text-green-600' : ''}
                ${!isLocked && !isAvailable && !isCompleted ? 'bg-gray-100 text-gray-400' : ''}
              `}>
                {isLocked ? <Lock size={20} /> : isCompleted ? <CheckCircle2 size={20} /> : <PlayCircle size={20} />}
              </div>

              {/* Node Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <h3 className={`font-bold text-base md:text-lg truncate ${isLocked ? 'text-gray-400' : 'text-gray-800'}`}>
                    {node.label}
                  </h3>
                  <div className="flex gap-0.5 shrink-0">
                    {[1, 2, 3].map((s) => (
                      <Star key={s} size={12} className={node.stars >= s ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                    ))}
                  </div>
                </div>
                <p className={`text-xs md:text-sm line-clamp-2 ${isLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                  {node.description}
                </p>
              </div>

              {/* Expand/Collapse Toggle */}
              {hasChildren && (
                <button
                  onClick={(e) => toggleCollapse(nodeId, e)}
                  className={`
                    ml-2 p-1.5 rounded-xl border-2 transition-all
                    ${isCollapsed ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-gray-50 border-gray-100 text-gray-400'}
                  `}
                >
                  {isCollapsed ? <Plus size={16} strokeWidth={3} /> : <Minus size={16} strokeWidth={3} />}
                </button>
              )}
            </button>
          </div>
        </div>

        {/* Render Children */}
        {!isCollapsed && hasChildren && (
          <div className="ml-10 mt-6 border-l-2 border-blue-50 pl-6 space-y-6 flex flex-col">
            {children.map(childId => renderNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="p-6 border-b flex justify-between items-center bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">{topic}</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">思维导图学习模式</p>
        </div>
        <div className="flex gap-2 shrink-0">
           <button 
             onClick={() => setCollapsedNodes(new Set())}
             className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
           >
             全部展开
           </button>
           <button 
             onClick={() => setCollapsedNodes(new Set(nodes.map(n => n.id)))}
             className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
           >
             全部收起
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {tree.roots.map(root => renderNode(root.id))}
          {tree.roots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <LoaderIcon className="animate-spin mb-4" />
              <p>正在努力构建知识网络...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default KnowledgeGraph;
