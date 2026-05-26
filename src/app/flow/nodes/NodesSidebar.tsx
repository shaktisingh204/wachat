"use client";

import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Clock,
  Zap,
  MessageSquare,
  Mail,
  Smartphone,
  Database,
  GitBranch,
  SplitSquareHorizontal,
  Box,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import type { NodeDescriptor } from '@/components/sabflow/panels/blocks/shared/NodeSettings';

// Fallback icon for generic nodes
const DefaultIcon = () => <Box className="h-4 w-4" />;

export function NodesSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [nodes, setNodes] = useState<NodeDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchNodes() {
      try {
        const res = await fetch('/api/sabflow/nodes');
        if (!res.ok) throw new Error('Failed to fetch node descriptors');
        
        const data = await res.json();
        if (mounted && data.nodes && Array.isArray(data.nodes)) {
          setNodes(data.nodes);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    fetchNodes();
    
    return () => { mounted = false; };
  }, []);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredNodes = nodes.filter(node => 
    node.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    node.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group nodes by category dynamically
  const categories = filteredNodes.reduce((acc, node) => {
    const cat = node.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(node);
    return acc;
  }, {} as Record<string, NodeDescriptor[]>);

  return (
    <aside className="w-72 shrink-0 flex flex-col border-r border-white/10 bg-[#0c0c0e] h-full z-10">
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md bg-[#18181b] border border-white/5 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
        
        {loading && (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading nodes...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && Object.entries(categories).map(([category, catNodes]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{category}</h3>
              <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{catNodes.length}</span>
            </div>
            <div className="space-y-1.5">
              {catNodes.map(node => (
                <DraggableNode 
                  key={node.name}
                  node={node}
                  onDragStart={(e) => onDragStart(e, node.name)}
                />
              ))}
            </div>
          </div>
        ))}
        
        {!loading && !error && filteredNodes.length === 0 && nodes.length > 0 && (
          <div className="text-center py-8 text-sm text-slate-500">
            No nodes found matching "{searchQuery}"
          </div>
        )}
      </div>
    </aside>
  );
}

function DraggableNode({ node, onDragStart }: { node: NodeDescriptor, onDragStart: (e: React.DragEvent<HTMLDivElement>) => void }) {
  // Use a heuristic for color based on properties
  const isTrigger = node.isTrigger;
  const isLogic = node.category?.toLowerCase() === 'logic' || node.category?.toLowerCase() === 'core';
  
  const color = isTrigger ? 'purple' : isLogic ? 'orange' : 'blue';
  
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:border-blue-500/40',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:border-purple-500/40',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20 group-hover:border-orange-500/40',
  };

  return (
    <div 
      className="group flex cursor-grab items-start gap-3 rounded-xl border border-white/5 bg-[#18181b] p-3 hover:bg-[#202024] hover:shadow-lg transition-all active:cursor-grabbing"
      draggable
      onDragStart={onDragStart}
    >
      <div className={`mt-0.5 flex shrink-0 h-8 w-8 items-center justify-center rounded-lg border ${colorMap[color]} transition-colors`}>
        <DefaultIcon />
      </div>
      <div>
        <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{node.displayName}</h4>
        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{node.description}</p>
      </div>
    </div>
  );
}
