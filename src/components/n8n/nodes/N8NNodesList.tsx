'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, Pin, PinOff } from 'lucide-react';
import { Input, IconButton, EmptyState, cn } from '@/components/sabcrm/20ui';
import { N8N_NODE_CATEGORIES, N8N_NODE_REGISTRY } from '../registry';
import { useWorkflow } from '../WorkflowContext';
import type { N8NNodeType } from '../types';

export function N8NNodesList() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [query, setQuery] = useState('');
  const { setDraggedNodeType } = useWorkflow();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const open = () => {
    clearTimeout(closeTimer.current);
    setIsOpen(true);
  };

  const scheduledClose = useCallback(() => {
    if (isLocked) return;
    closeTimer.current = setTimeout(() => setIsOpen(false), 200);
  }, [isLocked]);

  const toggleLock = () => {
    setIsLocked((v) => {
      if (v) setIsOpen(false);
      return !v;
    });
  };

  return (
    <div
      className="absolute left-0 top-0 h-full z-20 flex"
      onMouseEnter={open}
      onMouseLeave={scheduledClose}
    >
      {/* Invisible hover strip */}
      <div className="w-3 h-full" />

      {/* Panel */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-[320px] flex flex-col',
          'bg-[var(--st-bg)] border-r border-[var(--st-border)] shadow-lg',
          'transition-transform duration-200 ease-out',
          isOpen || isLocked ? 'translate-x-0' : '-translate-x-[310px]',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--st-border)]">
          <span className="text-[13px] font-semibold text-[var(--st-text)]">Nodes</span>
          <div className="flex items-center gap-2">
            <Input
              inputSize="sm"
              iconLeft={Search}
              type="text"
              placeholder="Search"
              aria-label="Search nodes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-[150px]"
            />
            <IconButton
              label={isLocked ? 'Unpin sidebar' : 'Pin sidebar'}
              icon={isLocked ? Pin : PinOff}
              size="sm"
              onClick={toggleLock}
              aria-pressed={isLocked}
            />
          </div>
        </div>

        {/* Node categories */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {Object.entries(N8N_NODE_CATEGORIES).map(([catKey, cat]) => {
            const filteredTypes = cat.types.filter((type) => {
              if (!query.trim()) return true;
              const meta = N8N_NODE_REGISTRY[type];
              return (
                meta.label.toLowerCase().includes(query.toLowerCase()) ||
                meta.description.toLowerCase().includes(query.toLowerCase())
              );
            });
            if (filteredTypes.length === 0) return null;

            return (
              <div key={catKey}>
                <div className="flex items-center gap-2 px-1 mb-2">
                  {/* Runtime-computed category color */}
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: cat.color }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                    {cat.label}
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredTypes.map((type) => (
                    <NodeCard
                      key={type}
                      type={type as N8NNodeType}
                      onDragStart={() => setDraggedNodeType(type as N8NNodeType)}
                      onDragEnd={() => setDraggedNodeType(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {query.trim() &&
            !Object.values(N8N_NODE_CATEGORIES).some((cat) =>
              cat.types.some((type) => {
                const meta = N8N_NODE_REGISTRY[type as N8NNodeType];
                return (
                  meta.label.toLowerCase().includes(query.toLowerCase()) ||
                  meta.description.toLowerCase().includes(query.toLowerCase())
                );
              }),
            ) && (
              <EmptyState
                size="sm"
                icon={Search}
                title="No nodes found"
                description={`Nothing matched "${query}".`}
              />
            )}
        </div>
      </div>
    </div>
  );
}

function NodeCard({
  type,
  onDragStart,
  onDragEnd,
}: {
  type: N8NNodeType;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [isDown, setIsDown] = useState(false);
  const meta = N8N_NODE_REGISTRY[type];
  const Icon = meta.icon;

  return (
    <div
      onMouseDown={() => {
        setIsDown(true);
        onDragStart();
      }}
      onMouseUp={() => {
        setIsDown(false);
        onDragEnd();
      }}
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2.5',
        'bg-[var(--st-bg-secondary)] hover:bg-[var(--st-bg)] hover:shadow-md',
        'cursor-grab transition-[box-shadow,background-color]',
        isDown ? 'opacity-40 cursor-grabbing' : 'opacity-100',
      )}
      title={meta.description}
    >
      {/* Runtime-computed node color */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5 text-[var(--st-text-inverted)]"
        style={{ background: meta.color }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-[var(--st-text)]">{meta.label}</div>
        <div className="text-[10.5px] text-[var(--st-text-secondary)] truncate leading-tight mt-0.5">
          {meta.description}
        </div>
      </div>
    </div>
  );
}
