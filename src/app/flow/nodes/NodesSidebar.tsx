"use client";

import React, { useState, useEffect } from 'react';
import { Search, Box } from 'lucide-react';
import { Field, Input, Alert, EmptyState, Spinner, Badge } from '@/components/sabcrm/20ui';
import type { NodeDescriptor } from '@/components/sabflow/panels/blocks/shared/NodeSettings';

// Fallback icon for generic nodes
const DefaultIcon = () => <Box className="h-4 w-4" aria-hidden="true" />;

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
    <aside className="20ui w-72 shrink-0 flex flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] h-full z-10">
      <div className="p-4 border-b border-[var(--st-border)]">
        <Field label="Search nodes">
          <Input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            iconLeft={Search}
          />
        </Field>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">

        {loading && (
          <div className="flex items-center justify-center py-10 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading nodes" className="mr-2" />
            <span className="text-sm">Loading nodes...</span>
          </div>
        )}

        {error && !loading && (
          <Alert tone="danger" title="Could not load nodes">
            {error}
          </Alert>
        )}

        {!loading && !error && Object.entries(categories).map(([category, catNodes]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">{category}</h3>
              <Badge tone="neutral">{catNodes.length}</Badge>
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
          <EmptyState
            icon={Search}
            title="No nodes found"
            description={`Nothing matches "${searchQuery}". Try a different search.`}
            size="sm"
          />
        )}
      </div>
    </aside>
  );
}

function DraggableNode({ node, onDragStart }: { node: NodeDescriptor, onDragStart: (e: React.DragEvent<HTMLDivElement>) => void }) {
  return (
    <div
      className="group flex cursor-grab items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 hover:border-[var(--st-accent)] hover:shadow-sm transition-all active:cursor-grabbing"
      draggable
      onDragStart={onDragStart}
    >
      <div className="mt-0.5 flex shrink-0 h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] group-hover:border-[var(--st-accent)] group-hover:text-[var(--st-accent)] transition-colors">
        <DefaultIcon />
      </div>
      <div>
        <h4 className="text-sm font-medium text-[var(--st-text)]">{node.displayName}</h4>
        <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)] line-clamp-1">{node.description}</p>
      </div>
    </div>
  );
}
