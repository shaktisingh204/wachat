'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { REGISTRY_CATEGORIES, type BlockRegistryEntry } from './blockRegistry';
import { cn } from '@/lib/utils';
import { LuPin, LuPinOff, LuSearch, LuChevronDown, LuX } from 'react-icons/lu';
import type { BlockType } from '@/lib/sabflow/types';

const LOCK_KEY = 'sabflow:sidebar:locked';

/* ── BlocksSideBar ──────────────────────────────────────── */
export function BlocksSideBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(LOCK_KEY) === 'true'; } catch { return false; }
  });
  const [query, setQuery] = useState('');
  const { setDraggedBlockType } = useBlockDnd();

  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initial open state follows lock
  useEffect(() => {
    if (isLocked) setIsOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback(() => {
    clearTimeout(closeTimer.current);
    setIsOpen(true);
  }, []);

  const scheduleClose = useCallback(() => {
    if (isLocked) return;
    closeTimer.current = setTimeout(() => setIsOpen(false), 180);
  }, [isLocked]);

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const next = !prev;
      try { localStorage.setItem(LOCK_KEY, String(next)); } catch { /* noop */ }
      if (!next) setIsOpen(false);
      return next;
    });
  }, []);

  const clearSearch = () => setQuery('');

  const isVisible = isOpen || isLocked;
  const lowerQuery = query.trim().toLowerCase();

  // Filter each category's entries by the search query
  const filteredCategories = REGISTRY_CATEGORIES.map((cat) => ({
    ...cat,
    entries: lowerQuery
      ? cat.entries.filter((e) => e.label.toLowerCase().includes(lowerQuery))
      : cat.entries,
  })).filter((cat) => cat.entries.length > 0);

  const hasNoResults = lowerQuery.length > 0 && filteredCategories.length === 0;

  return (
    <div
      className="absolute left-0 top-0 h-full z-20 flex"
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      {/* Thin hot-zone to trigger reveal when sidebar is hidden */}
      {!isVisible && (
        <div
          className="w-3 h-full cursor-pointer"
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-[260px] flex flex-col',
          'bg-[var(--gray-1)] border-r border-[var(--gray-5)]',
          'shadow-[4px_0_16px_-4px_rgba(0,0,0,0.12)]',
          'transition-transform duration-200 ease-out select-none',
          isVisible ? 'translate-x-0' : '-translate-x-[257px]',
        )}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--gray-4)] shrink-0">
          {/* Search */}
          <div className="relative flex-1">
            <LuSearch
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--gray-9)] pointer-events-none"
              strokeWidth={2}
            />
            <input
              type="text"
              placeholder="Search blocks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                'w-full py-1.5 text-[12px] rounded-md',
                'bg-[var(--gray-3)] border border-[var(--gray-5)]',
                'text-[var(--gray-12)] placeholder:text-[var(--gray-9)]',
                'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20',
                'transition-colors',
              )}
              style={{ paddingLeft: '1.875rem', paddingRight: query ? '1.5rem' : '0.5rem' }}
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--gray-9)] hover:text-[var(--gray-12)] transition-colors"
              >
                <LuX className="h-3 w-3" strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Pin toggle */}
          <button
            onClick={toggleLock}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
              isLocked
                ? 'bg-[#f76808]/10 text-[#f76808]'
                : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
            )}
            title={isLocked ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            {isLocked
              ? <LuPin className="h-3.5 w-3.5" strokeWidth={2} />
              : <LuPinOff className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        </div>

        {/* ── Block categories ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-2.5 px-2.5 space-y-1">
          {filteredCategories.map((cat) => (
            <CategorySection
              key={cat.key}
              label={cat.label}
              color={cat.color}
              entries={cat.entries}
              defaultOpen={true}
              onDragStart={(type) => setDraggedBlockType(type)}
              onDragEnd={() => setDraggedBlockType(undefined)}
            />
          ))}

          {/* Empty state */}
          {hasNoResults && (
            <div className="flex flex-col items-center py-8 gap-2 text-[var(--gray-9)]">
              <LuSearch className="h-5 w-5 opacity-40" />
              <p className="text-[12px]">No blocks match &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* Dock handle — visible only when panel is hidden and not locked */}
      {!isVisible && !isLocked && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-3 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="h-12 w-1 rounded-full bg-[var(--gray-6)] opacity-70" />
        </div>
      )}
    </div>
  );
}

/* ── CategorySection ────────────────────────────────────── */
function CategorySection({
  label,
  color,
  entries,
  defaultOpen,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  color: string;
  entries: BlockRegistryEntry[];
  defaultOpen: boolean;
  onDragStart: (type: BlockType) => void;
  onDragEnd: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-1.5 py-1.5 rounded-md',
          'hover:bg-[var(--gray-3)] transition-colors group',
        )}
      >
        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)] group-hover:text-[var(--gray-11)] transition-colors">
          {label}
        </span>
        <span className="text-[10px] text-[var(--gray-8)] font-normal tabular-nums mr-0.5">
          {entries.length}
        </span>
        <LuChevronDown
          className={cn(
            'h-3 w-3 text-[var(--gray-8)] transition-transform duration-150',
            !isExpanded && '-rotate-90',
          )}
          strokeWidth={2.5}
        />
      </button>

      {/* Block grid */}
      {isExpanded && (
        <div className="grid grid-cols-2 gap-1.5 pt-1 pb-1.5 px-0.5">
          {entries.map((entry) => (
            <BlockCard
              key={entry.type}
              entry={entry}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── BlockCard ──────────────────────────────────────────── */
function BlockCard({
  entry,
  onDragStart,
  onDragEnd,
}: {
  entry: BlockRegistryEntry;
  onDragStart: (type: BlockType) => void;
  onDragEnd: () => void;
}) {
  const [isGrabbing, setIsGrabbing] = useState(false);
  const { type, label, icon: Icon, color, description } = entry;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={false} // drag is handled via mousedown/up — Graph.tsx drops it
      onMouseDown={() => {
        setIsGrabbing(true);
        onDragStart(type);
      }}
      onMouseUp={() => {
        setIsGrabbing(false);
        onDragEnd();
      }}
      onMouseLeave={() => {
        // Do NOT end drag on mouse-leave — Graph.tsx handles the drop.
        // Only reset the visual grab state.
        if (isGrabbing) setIsGrabbing(false);
      }}
      title={description}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg',
        'border border-[var(--gray-5)] bg-[var(--gray-2)]',
        'hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)]',
        'transition-colors',
        isGrabbing
          ? 'opacity-40 cursor-grabbing shadow-none'
          : 'cursor-grab hover:shadow-sm active:cursor-grabbing',
      )}
    >
      {/* Icon badge */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: color + '20', color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Label */}
      <span className="text-[12.5px] font-medium text-[var(--gray-12)] truncate leading-tight">
        {label}
      </span>
    </div>
  );
}
