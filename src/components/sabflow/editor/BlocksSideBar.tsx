'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { REGISTRY_CATEGORIES, type BlockRegistryEntry } from './blockRegistry';
import { useDescriptorCategories } from './descriptorRegistry';
import { cn } from '@/lib/utils';
import {
  LuPin,
  LuPinOff,
  LuSearch,
  LuChevronDown,
  LuChevronRight,
  LuX,
  LuClock,
} from 'react-icons/lu';
import type { BlockType } from '@/lib/sabflow/types';

/* ── Constants ──────────────────────────────────────────── */

const LOCK_KEY = 'sabflow:sidebar:locked';
const RECENT_KEY = 'sabflow:sidebar:recent';
const COLLAPSED_KEY = 'sabflow:sidebar:collapsed';
const MAX_RECENT = 5;

/* ── localStorage helpers ───────────────────────────────── */

function readRecent(): BlockType[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BlockType[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(types: BlockType[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(types));
  } catch {
    /* noop */
  }
}

function readCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeCollapsed(collapsed: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    /* noop */
  }
}

/* ── BlocksSideBar ──────────────────────────────────────── */
export function BlocksSideBar() {
  // Pinned/visible by default. The pin button still toggles it, but we no
  // longer reveal/hide it on hover — that surprise reveal was reported as
  // "nodes appearing on left side hover" when users expected a click‑driven
  // panel.
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const v = localStorage.getItem(LOCK_KEY);
      if (v === null) return true;
      return v === 'true';
    } catch {
      return true;
    }
  });
  const [query, setQuery] = useState('');
  const [recentTypes, setRecentTypes] = useState<BlockType[]>(() => readRecent());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed());

  const { setDraggedBlockType } = useBlockDnd();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LOCK_KEY, String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    searchInputRef.current?.focus();
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSearch();
      }
    },
    [clearSearch],
  );

  /** Called when a block is dragged — records it in recent list. */
  const handleDragStart = useCallback(
    (type: BlockType) => {
      setDraggedBlockType(type);
      setRecentTypes((prev) => {
        const next = [type, ...prev.filter((t) => t !== type)].slice(0, MAX_RECENT);
        writeRecent(next);
        return next;
      });
    },
    [setDraggedBlockType],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedBlockType(undefined);
  }, [setDraggedBlockType]);

  const clearRecent = useCallback(() => {
    setRecentTypes([]);
    writeRecent([]);
  }, []);

  const toggleCategory = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      writeCollapsed(next);
      return next;
    });
  }, []);

  const isVisible = isLocked;
  const lowerQuery = query.trim().toLowerCase();

  // Dynamic n8n-parity descriptor categories (fetched from the Rust runtime)
  const descriptorCats = useDescriptorCategories();

  // De-dup descriptor entries that have the same `type` as a native registry
  // entry — the hand-written native block wins.
  const nativeTypes = new Set(
    REGISTRY_CATEGORIES.flatMap((cat) => cat.entries.map((e) => e.type as string)),
  );
  const dynamicCategories = descriptorCats.categories.map((cat) => ({
    ...cat,
    entries: cat.entries.filter((e) => !nativeTypes.has(e.type as string)),
  })).filter((cat) => cat.entries.length > 0);

  // Filter each category's entries by the search query
  const filterByQuery = <T extends BlockRegistryEntry>(entries: T[]) =>
    lowerQuery
      ? entries.filter(
          (e) =>
            e.label.toLowerCase().includes(lowerQuery) ||
            e.description.toLowerCase().includes(lowerQuery),
        )
      : entries;

  const filteredCategories = REGISTRY_CATEGORIES.map((cat) => ({
    ...cat,
    entries: filterByQuery(cat.entries),
  })).filter((cat) => cat.entries.length > 0);

  const filteredDynamicCategories = dynamicCategories
    .map((cat) => ({ ...cat, entries: filterByQuery(cat.entries) }))
    .filter((cat) => cat.entries.length > 0);

  const hasNoResults =
    lowerQuery.length > 0 &&
    filteredCategories.length === 0 &&
    filteredDynamicCategories.length === 0;

  // Build recent entries from the full registry (native + dynamic)
  const allEntries = [
    ...REGISTRY_CATEGORIES.flatMap((cat) => cat.entries),
    ...descriptorCats.allEntries.filter((e) => !nativeTypes.has(e.type as string)),
  ];
  const recentEntries = recentTypes
    .map((type) => allEntries.find((e) => e.type === type))
    .filter((e): e is BlockRegistryEntry => e !== undefined);

  return (
    <div className="absolute left-0 top-0 h-full z-20 flex">
      {/* Pinned-by-default panel. No hover reveal — toggle via the pin button. */}
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
              ref={searchInputRef}
              type="text"
              placeholder="Search blocks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
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
                aria-label="Clear search"
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
            {isLocked ? (
              <LuPin className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <LuPinOff className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>
        </div>

        {/* ── Block list ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-2.5 px-2.5 space-y-1">

          {/* Recently used section — hidden while searching */}
          {!lowerQuery && recentEntries.length > 0 && (
            <RecentSection
              entries={recentEntries}
              onClear={clearRecent}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          )}

          {/* Category sections */}
          {filteredCategories.map((cat) => (
            <CategorySection
              key={cat.key}
              catKey={cat.key}
              label={cat.label}
              color={cat.color}
              entries={cat.entries}
              isCollapsed={collapsed.has(cat.key)}
              onToggle={toggleCategory}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}

          {/* n8n-parity dynamic categories (fetched from Rust) */}
          {filteredDynamicCategories.length > 0 && (
            <div className="pt-3 mt-2 border-t border-[var(--gray-4)]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gray-8)] mb-2 px-1.5">
                n8n-parity integrations
              </p>
              {filteredDynamicCategories.map((cat) => (
                <CategorySection
                  key={cat.key}
                  catKey={cat.key}
                  label={cat.label}
                  color={cat.color}
                  entries={cat.entries}
                  isCollapsed={collapsed.has(cat.key)}
                  onToggle={toggleCategory}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {descriptorCats.loading && !lowerQuery && (
            <div className="text-[11px] text-[var(--gray-8)] px-2 py-2">Loading more integrations…</div>
          )}

          {/* Empty state */}
          {hasNoResults && (
            <div className="flex flex-col items-center py-8 gap-2 text-[var(--gray-9)]">
              <LuSearch className="h-5 w-5 opacity-40" />
              <p className="text-[12px]">No blocks match &ldquo;{query}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* Reopen button — when the user has unpinned/closed the palette,
          give them an explicit click target to bring it back. No hover
          surprise; only an obvious button. */}
      {!isVisible && (
        <button
          type="button"
          onClick={toggleLock}
          aria-label="Open block palette"
          title="Open block palette"
          className={cn(
            'absolute left-2 top-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md',
            'bg-[var(--gray-1)] border border-[var(--gray-5)] shadow-sm',
            'text-[12px] font-medium text-[var(--gray-12)]',
            'hover:bg-[var(--gray-3)] hover:border-[var(--gray-7)] transition-colors',
          )}
        >
          <LuPinOff className="h-3.5 w-3.5" strokeWidth={2} />
          Blocks
        </button>
      )}
    </div>
  );
}

/* ── RecentSection ──────────────────────────────────────── */
function RecentSection({
  entries,
  onClear,
  onDragStart,
  onDragEnd,
}: {
  entries: BlockRegistryEntry[];
  onClear: () => void;
  onDragStart: (type: BlockType) => void;
  onDragEnd: () => void;
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex w-full items-center gap-2 px-1.5 py-1.5">
        <LuClock className="h-3 w-3 text-[var(--gray-8)] shrink-0" strokeWidth={2} />
        <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)]">
          Recently Used
        </span>
        <button
          onClick={onClear}
          aria-label="Clear recent history"
          className="text-[var(--gray-8)] hover:text-[var(--gray-11)] transition-colors"
          title="Clear recent history"
        >
          <LuX className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>

      {/* Block grid */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 pb-1.5 px-0.5">
        {entries.map((entry) => (
          <BlockCard
            key={`recent-${entry.type}`}
            entry={entry}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

/* ── CategorySection ────────────────────────────────────── */
function CategorySection({
  catKey,
  label,
  color,
  entries,
  isCollapsed,
  onToggle,
  onDragStart,
  onDragEnd,
}: {
  catKey: string;
  label: string;
  color: string;
  entries: BlockRegistryEntry[];
  isCollapsed: boolean;
  onToggle: (key: string) => void;
  onDragStart: (type: BlockType) => void;
  onDragEnd: () => void;
}) {
  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => onToggle(catKey)}
        className={cn(
          'flex w-full items-center gap-2 px-1.5 py-1.5 rounded-md',
          'hover:bg-[var(--gray-3)] transition-colors group',
        )}
        aria-expanded={!isCollapsed}
      >
        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)] group-hover:text-[var(--gray-11)] transition-colors">
          {label}
        </span>
        {/* Count badge */}
        <span className="text-[10px] text-[var(--gray-8)] font-normal tabular-nums mr-0.5 px-1.5 py-0.5 rounded-full bg-[var(--gray-3)] group-hover:bg-[var(--gray-4)] transition-colors">
          {entries.length}
        </span>
        {/* Chevron */}
        {isCollapsed ? (
          <LuChevronRight
            className="h-3 w-3 text-[var(--gray-8)] transition-transform duration-150"
            strokeWidth={2.5}
          />
        ) : (
          <LuChevronDown
            className="h-3 w-3 text-[var(--gray-8)] transition-transform duration-150"
            strokeWidth={2.5}
          />
        )}
      </button>

      {/* Block grid */}
      {!isCollapsed && (
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
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { type, label, icon: Icon, color, description } = entry;

  const handleMouseEnter = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 600);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(tooltipTimer.current);
    setShowTooltip(false);
    // Do NOT end drag on mouse-leave — Graph.tsx handles the drop.
    // Only reset the visual grab state.
    if (isGrabbing) setIsGrabbing(false);
  }, [isGrabbing]);

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        draggable={false} // drag is handled via mousedown/up — Graph.tsx drops it
        onMouseDown={() => {
          setIsGrabbing(true);
          setShowTooltip(false);
          clearTimeout(tooltipTimer.current);
          onDragStart(type);
        }}
        onMouseUp={() => {
          setIsGrabbing(false);
          onDragEnd();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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

      {/* CSS tooltip — positioned to the right of the card */}
      {showTooltip && !isGrabbing && (
        <div
          role="tooltip"
          className={cn(
            'absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-50',
            'px-2.5 py-1.5 rounded-md pointer-events-none',
            'bg-[var(--gray-12)] text-[var(--gray-1)]',
            'text-[11px] leading-snug whitespace-nowrap',
            'shadow-lg',
          )}
          style={{ maxWidth: '200px', whiteSpace: 'normal' }}
        >
          {/* Arrow pointing left */}
          <span
            aria-hidden="true"
            className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
            style={{ borderRightColor: 'var(--gray-12)' }}
          />
          <p className="font-medium text-[11.5px] mb-0.5">{label}</p>
          <p className="text-[10.5px] opacity-70">{description}</p>
        </div>
      )}
    </div>
  );
}
