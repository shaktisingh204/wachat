'use client';

import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { REGISTRY_CATEGORIES, type BlockRegistryEntry } from './blockRegistry';
import { useDescriptorCategories } from './descriptorRegistry';
import { cn } from '@/lib/utils';
import {
  Pin,
  PinOff,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Clock,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';
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
  // longer reveal/hide it on hover. That surprise reveal was reported as
  // "nodes appearing on left side hover" when users expected a click-driven
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

  /** Called when a block is dragged. Records it in the recent list. */
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
  // entry. The hand-written native block wins.
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
    <div className="20ui absolute left-0 top-0 h-full z-20 flex">
      {/* Pinned-by-default panel. No hover reveal. Toggle via the pin button. */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-[260px] flex flex-col',
          'bg-[var(--st-bg)] border-r border-[var(--st-border)]',
          'shadow-[4px_0_16px_-4px_rgba(0,0,0,0.12)]',
          'transition-transform duration-200 ease-out select-none',
          isVisible ? 'translate-x-0' : '-translate-x-[257px]',
        )}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--st-border)] shrink-0">
          {/* Search */}
          <div className="flex-1">
            <Input
              ref={searchInputRef}
              type="text"
              inputSize="sm"
              aria-label="Search blocks"
              placeholder="Search blocks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              iconLeft={Search}
              suffix={
                query ? (
                  <IconButton
                    label="Clear search"
                    icon={X}
                    size="sm"
                    onClick={clearSearch}
                  />
                ) : undefined
              }
            />
          </div>

          {/* Pin toggle */}
          <IconButton
            label={isLocked ? 'Unpin sidebar' : 'Pin sidebar open'}
            icon={isLocked ? Pin : PinOff}
            size="sm"
            onClick={toggleLock}
            className={cn(isLocked && 'text-[var(--st-text)]')}
          />
        </div>

        {/* ── Block list ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-2.5 px-2.5 space-y-1">

          {/* Recently used section. Hidden while searching. */}
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
            <div className="pt-3 mt-2 border-t border-[var(--st-border)]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)] mb-2 px-1.5">
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
            <div className="text-[11px] text-[var(--st-text-tertiary)] px-2 py-2">Loading more integrations...</div>
          )}

          {/* Empty state */}
          {hasNoResults && (
            <EmptyState
              icon={Search}
              size="sm"
              title={`No blocks match "${query}"`}
            />
          )}
        </div>
      </div>

      {/* Reopen button. When the user has unpinned/closed the palette, give
          them an explicit click target to bring it back. No hover surprise,
          only an obvious button. */}
      {!isVisible && (
        <Button
          size="sm"
          variant="secondary"
          iconLeft={PinOff}
          onClick={toggleLock}
          aria-label="Open block palette"
          title="Open block palette"
          className="absolute left-2 top-4"
        >
          Blocks
        </Button>
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
        <Clock className="h-3 w-3 text-[var(--st-text-tertiary)] shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
          Recently Used
        </span>
        <IconButton
          label="Clear recent history"
          icon={X}
          size="sm"
          onClick={onClear}
        />
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
      <Button
        variant="ghost"
        size="sm"
        block
        onClick={() => onToggle(catKey)}
        aria-expanded={!isCollapsed}
        className="!justify-start !px-1.5 group"
      >
        <span className="flex w-full items-center gap-2">
          {/* Category color dot. The color is runtime-defined per category. */}
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: color }}
            aria-hidden="true"
          />
          <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
            {label}
          </span>
          {/* Count badge */}
          <Badge tone="neutral" className="tabular-nums">
            {entries.length}
          </Badge>
          {/* Chevron */}
          {isCollapsed ? (
            <ChevronRight
              className="h-3 w-3 text-[var(--st-text-tertiary)]"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              className="h-3 w-3 text-[var(--st-text-tertiary)]"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          )}
        </span>
      </Button>

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
    // Do NOT end drag on mouse-leave. Graph.tsx handles the drop.
    // Only reset the visual grab state.
    if (isGrabbing) setIsGrabbing(false);
  }, [isGrabbing]);

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        draggable={false} // drag is handled via mousedown/up, Graph.tsx drops it
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
          'flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--st-radius)]',
          'border border-[var(--st-border)] bg-[var(--st-bg-secondary)]',
          'hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-muted)]',
          'transition-colors',
          isGrabbing
            ? 'opacity-40 cursor-grabbing shadow-none'
            : 'cursor-grab hover:shadow-sm active:cursor-grabbing',
        )}
      >
        {/* Icon badge. The tint + glyph color are derived from the runtime
            per-block `color` value. */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: color + '20', color }}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>

        {/* Label */}
        <span className="text-[12.5px] font-medium text-[var(--st-text)] truncate leading-tight">
          {label}
        </span>
      </div>

      {/* CSS tooltip. Positioned to the right of the card. */}
      {showTooltip && !isGrabbing && (
        <div
          role="tooltip"
          className={cn(
            'absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-50',
            'px-2.5 py-1.5 rounded-[var(--st-radius)] pointer-events-none',
            'bg-[var(--st-text)] text-[var(--st-text-inverted)]',
            'text-[11px] leading-snug max-w-[200px] whitespace-normal',
            'shadow-lg',
          )}
        >
          {/* Arrow pointing left. Uses the same surface token as the tooltip. */}
          <span
            aria-hidden="true"
            className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[var(--st-text)]"
          />
          <p className="font-medium text-[11.5px] mb-0.5">{label}</p>
          <p className="text-[10.5px] opacity-70">{description}</p>
        </div>
      )}
    </div>
  );
}
