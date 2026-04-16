'use client';
import { useState, useRef, useCallback } from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { BLOCK_CATEGORIES, getBlockIcon, getBlockLabel, getBlockColor } from '@/lib/sabflow/blocks';
import { cn } from '@/lib/utils';
import { LuPin, LuPinOff, LuSearch } from 'react-icons/lu';
import type { BlockType } from '@/lib/sabflow/types';

export function BlocksSideBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [query, setQuery] = useState('');
  const { setDraggedBlockType } = useBlockDnd();
  const sidebarRef = useRef<HTMLDivElement>(null);
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
      {/* Invisible hover area to trigger open */}
      <div className="w-3 h-full" />

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className={cn(
          'absolute left-0 top-0 h-full w-[360px] flex flex-col',
          'bg-[var(--gray-1)] border-r border-[var(--gray-5)] shadow-lg',
          'transition-transform duration-200 ease-out',
          isOpen || isLocked ? 'translate-x-0' : '-translate-x-[350px]',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--gray-4)]">
          <span className="text-[13px] font-semibold text-[var(--gray-12)]">Blocks</span>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <LuSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--gray-9)]" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-[140px] pl-8 pr-3 py-1.5 text-[12px] bg-[var(--gray-3)] border border-[var(--gray-5)] rounded-lg outline-none focus:border-[#f76808]"
              />
            </div>
            {/* Pin */}
            <button
              onClick={toggleLock}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
              title={isLocked ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              {isLocked
                ? <LuPin className="h-3.5 w-3.5" strokeWidth={2} />
                : <LuPinOff className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          </div>
        </div>

        {/* Block categories */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {Object.entries(BLOCK_CATEGORIES).map(([catKey, cat]) => {
            const filteredTypes = cat.types.filter((type) => {
              if (!query.trim()) return true;
              return getBlockLabel(type).toLowerCase().includes(query.toLowerCase());
            });
            if (filteredTypes.length === 0) return null;

            return (
              <div key={catKey}>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)]">
                    {cat.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {filteredTypes.map((type) => (
                    <BlockCard
                      key={type}
                      type={type as BlockType}
                      onDragStart={() => setDraggedBlockType(type as BlockType)}
                      onDragEnd={() => setDraggedBlockType(undefined)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  type,
  onDragStart,
  onDragEnd,
}: {
  type: BlockType;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const Icon = getBlockIcon(type);
  const label = getBlockLabel(type);
  const color = getBlockColor(type);

  return (
    <div
      onMouseDown={() => {
        setIsMouseDown(true);
        onDragStart();
      }}
      onMouseUp={() => {
        setIsMouseDown(false);
        onDragEnd();
      }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-[var(--gray-5)] px-3 py-2',
        'bg-[var(--gray-2)] hover:bg-[var(--gray-1)] hover:shadow-md',
        'cursor-grab transition-[box-shadow,background-color]',
        isMouseDown ? 'opacity-40 cursor-grabbing' : 'opacity-100',
      )}
      title={label}
    >
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
        style={{ background: `${color}22`, color }}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <span className="text-[11.5px] font-medium text-[var(--gray-12)] truncate">{label}</span>
    </div>
  );
}
