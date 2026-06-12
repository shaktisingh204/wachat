'use client';

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useDeferredValue,
  type KeyboardEvent,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BrandIcon } from '@/components/sabflow/BrandIcon';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import {
  useAppCatalog,
  type AppCatalogEntry,
} from '@/lib/sabflow/editor-catalog/useAppCatalog';
import { cn } from '@/lib/utils';
import {
  Pin,
  PinOff,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Clock,
  LayoutGrid,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';

// Avoid the React SSR warning for useLayoutEffect — the measurement only
// matters in the browser anyway.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ── Constants ──────────────────────────────────────────── */

const LOCK_KEY = 'sabflow:sidebar:locked';
const RECENT_KEY = 'sabflow:sidebar:recent';
const COLLAPSED_KEY = 'sabflow:sidebar:collapsed';
const APPS_EXPANDED_KEY = 'sabflow:sidebar:apps-expanded';
const MAX_RECENT = 5;

/** Core palette sections (catalog kind 'core'), keyed by catalog category label. */
const CORE_SECTIONS: { key: string; label: string; color: string }[] = [
  { key: 'Bubbles', label: 'Bubbles', color: '#6366f1' },
  { key: 'Inputs', label: 'Inputs', color: '#0ea5e9' },
  { key: 'Logic', label: 'Logic', color: '#f97316' },
];

/* ── localStorage helpers ───────────────────────────────── */

function readStringArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
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
  // Recent stores catalog entry keys. Old persisted BlockType values remain
  // valid keys (key === blockType for every non-preset entry).
  const [recentKeys, setRecentKeys] = useState<string[]>(() => readStringArray(RECENT_KEY));
  // Core sections: expanded by default, persist the collapsed set.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(readStringArray(COLLAPSED_KEY)),
  );
  // App categories: collapsed by default, persist the expanded set.
  const [appsExpanded, setAppsExpanded] = useState<Set<string>>(
    () => new Set(readStringArray(APPS_EXPANDED_KEY)),
  );

  const { setDraggedBlockType, setDraggedBlockOptions } = useBlockDnd();
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
    (entry: AppCatalogEntry) => {
      setDraggedBlockType(entry.blockType);
      setDraggedBlockOptions(entry.defaultOptions);
      setRecentKeys((prev) => {
        const next = [entry.key, ...prev.filter((k) => k !== entry.key)].slice(0, MAX_RECENT);
        writeStringArray(RECENT_KEY, next);
        return next;
      });
    },
    [setDraggedBlockType, setDraggedBlockOptions],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedBlockType(undefined);
    setDraggedBlockOptions(undefined);
  }, [setDraggedBlockType, setDraggedBlockOptions]);

  const clearRecent = useCallback(() => {
    setRecentKeys([]);
    writeStringArray(RECENT_KEY, []);
  }, []);

  const toggleCategory = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      writeStringArray(COLLAPSED_KEY, [...next]);
      return next;
    });
  }, []);

  const toggleAppCategory = useCallback((key: string) => {
    setAppsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      writeStringArray(APPS_EXPANDED_KEY, [...next]);
      return next;
    });
  }, []);

  const isVisible = isLocked;

  // Defer search filtering so typing stays responsive against ~1.4k entries.
  const deferredQuery = useDeferredValue(query);
  const lowerQuery = deferredQuery.trim().toLowerCase();

  // Unified catalog: native + rust + forge + preset, deduped by slug.
  const { entries, appCount, counts, loading } = useAppCatalog();

  const matches = useCallback(
    (e: AppCatalogEntry) =>
      !lowerQuery ||
      e.label.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery) ||
      e.slug.includes(lowerQuery),
    [lowerQuery],
  );

  /* Core sections (Bubbles / Inputs / Logic). */
  const coreSections = useMemo(() => {
    return CORE_SECTIONS.map((meta) => ({
      ...meta,
      entries: entries.filter(
        (e) => e.kind === 'core' && e.category === meta.key && matches(e),
      ),
    })).filter((s) => s.entries.length > 0);
  }, [entries, matches]);

  /* Apps super-section: every non-core entry grouped by category label. */
  const appCategories = useMemo(() => {
    const buckets = new Map<string, AppCatalogEntry[]>();
    for (const e of entries) {
      if (e.kind === 'core' || !matches(e)) continue;
      const arr = buckets.get(e.category) ?? [];
      arr.push(e);
      buckets.set(e.category, arr);
    }
    return [...buckets.entries()]
      .map(([category, list]) => ({
        category,
        entries: list.sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [entries, matches]);

  /* Flattened virtual rows for the apps list (headers + one-per-row entries). */
  type AppsRow =
    | { type: 'header'; category: string; count: number; expanded: boolean }
    | { type: 'entries'; items: AppCatalogEntry[]; category: string; index: number };

  const appRows = useMemo<AppsRow[]>(() => {
    const rows: AppsRow[] = [];
    const searching = lowerQuery.length > 0;
    for (const cat of appCategories) {
      // Collapsed by default; force-expanded while searching so results show.
      const expanded = searching || appsExpanded.has(cat.category);
      rows.push({
        type: 'header',
        category: cat.category,
        count: cat.entries.length,
        expanded,
      });
      if (!expanded) continue;
      for (let i = 0; i < cat.entries.length; i += 1) {
        rows.push({
          type: 'entries',
          items: cat.entries.slice(i, i + 1),
          category: cat.category,
          index: i,
        });
      }
    }
    return rows;
  }, [appCategories, appsExpanded, lowerQuery]);

  /* Virtualization. The whole palette shares one scroll container, so the
   * virtualizer uses `scrollMargin` = the apps wrapper's offset within it
   * (tracked via layout effect — recent/core sections above change height). */
  const scrollRef = useRef<HTMLDivElement>(null);
  const appsAnchorRef = useRef<HTMLDivElement>(null);
  const [appsOffset, setAppsOffset] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const el = appsAnchorRef.current;
    if (el && el.offsetTop !== appsOffset) setAppsOffset(el.offsetTop);
  });

  const rowVirtualizer = useVirtualizer({
    count: appRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (appRows[i]?.type === 'header' ? 30 : 48),
    overscan: 10,
    scrollMargin: appsOffset,
    getItemKey: (i) => {
      const row = appRows[i];
      return row.type === 'header'
        ? `h:${row.category}`
        : `e:${row.category}:${row.index}`;
    },
  });

  const hasNoResults =
    lowerQuery.length > 0 && coreSections.length === 0 && appCategories.length === 0;

  /* Recently used — resolve stored keys against the catalog. */
  const recentEntries = useMemo(() => {
    if (recentKeys.length === 0) return [];
    const byKey = new Map(entries.map((e) => [e.key, e]));
    return recentKeys
      .map((k) => byKey.get(k))
      .filter((e): e is AppCatalogEntry => e !== undefined);
  }, [recentKeys, entries]);

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
              aria-label="Search blocks and apps"
              placeholder="Search blocks & apps..."
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
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto py-2.5 px-2.5">

          {/* Recently used section. Hidden while searching. */}
          {!lowerQuery && recentEntries.length > 0 && (
            <RecentSection
              entries={recentEntries}
              onClear={clearRecent}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          )}

          {/* Core sections (Bubbles / Inputs / Logic) */}
          {coreSections.map((cat) => (
            <CategorySection
              key={cat.key}
              catKey={cat.key}
              label={cat.label}
              color={cat.color}
              entries={cat.entries}
              isCollapsed={collapsed.has(cat.key) && !lowerQuery}
              onToggle={toggleCategory}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}

          {/* ── Apps super-section (native + rust + forge + preset) ── */}
          <div
            ref={appsAnchorRef}
            className={cn(
              'pt-3 mt-2 border-t border-[var(--st-border)]',
              // Hide entirely when a search has no app hits (core sections
              // may still match above).
              lowerQuery && appCategories.length === 0 && 'hidden',
            )}
          >
            <div className="flex items-center gap-2 px-1.5 pb-2">
              <LayoutGrid
                className="h-3 w-3 text-[var(--st-text-tertiary)] shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
              <p className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
                Apps
              </p>
              {!loading && (
                <span
                  data-testid="sabflow-apps-count"
                  className="text-[10px] tabular-nums text-[var(--st-text-tertiary)]"
                  title={`${counts.native} native · ${counts.rust} rust · ${counts.forge} forge · ${counts.preset} preset`}
                >
                  {appCount} apps · {counts.native}/{counts.rust}/{counts.forge}/{counts.preset}
                </span>
              )}
            </div>

            {/* Virtualized rows: category headers + one-per-row entries. */}
            <div
              className="relative w-full"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const row = appRows[vi.index];
                if (!row) return null;
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full"
                    style={{
                      transform: `translateY(${vi.start - appsOffset}px)`,
                    }}
                  >
                    {row.type === 'header' ? (
                      <AppCategoryHeader
                        category={row.category}
                        count={row.count}
                        expanded={row.expanded}
                        onToggle={toggleAppCategory}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 px-0.5 pb-1.5">
                        {row.items.map((entry) => (
                          <BlockCard
                            key={entry.key}
                            entry={entry}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {loading && !lowerQuery && (
              <div className="text-[11px] text-[var(--st-text-tertiary)] px-2 py-2">
                Loading apps...
              </div>
            )}
          </div>

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

/* ── AppCategoryHeader ──────────────────────────────────── */
function AppCategoryHeader({
  category,
  count,
  expanded,
  onToggle,
}: {
  category: string;
  count: number;
  expanded: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      block
      onClick={() => onToggle(category)}
      aria-expanded={expanded}
      className="!justify-start !px-1.5"
    >
      <span className="flex w-full items-center gap-2">
        <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] truncate">
          {category}
        </span>
        <Badge tone="neutral" className="tabular-nums">
          {count}
        </Badge>
        {expanded ? (
          <ChevronDown
            className="h-3 w-3 text-[var(--st-text-tertiary)]"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="h-3 w-3 text-[var(--st-text-tertiary)]"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        )}
      </span>
    </Button>
  );
}

/* ── RecentSection ──────────────────────────────────────── */
function RecentSection({
  entries,
  onClear,
  onDragStart,
  onDragEnd,
}: {
  entries: AppCatalogEntry[];
  onClear: () => void;
  onDragStart: (entry: AppCatalogEntry) => void;
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
      <div className="grid grid-cols-1 gap-1.5 pt-1 pb-1.5 px-0.5">
        {entries.map((entry) => (
          <BlockCard
            key={`recent-${entry.key}`}
            entry={entry}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

/* ── CategorySection (core: bubbles / inputs / logic) ───── */
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
  entries: AppCatalogEntry[];
  isCollapsed: boolean;
  onToggle: (key: string) => void;
  onDragStart: (entry: AppCatalogEntry) => void;
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
        <div className="grid grid-cols-1 gap-1.5 pt-1 pb-1.5 px-0.5">
          {entries.map((entry) => (
            <BlockCard
              key={entry.key}
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
  entry: AppCatalogEntry;
  onDragStart: (entry: AppCatalogEntry) => void;
  onDragEnd: () => void;
}) {
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { label, icon: Icon, color, description, brandIcon, draft } = entry;

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

  // Lucide fallback used both standalone and as the Iconify `fallback`
  // (Iconify renders nothing for missing icons, so speculative `logos:`
  // names from getBrandIconForSlug always need this behind them).
  const fallbackIcon = <Icon className="h-3.5 w-3.5" aria-hidden="true" />;

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
          onDragStart(entry);
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
        {/* Icon badge. Brand logo (full-colour iconify) when resolvable,
            else the lucide icon tinted by the runtime per-block color. */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: color + '20', color }}
        >
          {brandIcon ? (
            <BrandIcon
              icon={brandIcon}
              className="h-4 w-4"
              fallback={fallbackIcon}
              aria-hidden
            />
          ) : (
            fallbackIcon
          )}
        </div>

        {/* Label */}
        <span className="min-w-0 flex-1 text-[12.5px] font-medium text-[var(--st-text)] truncate leading-tight">
          {label}
        </span>

        {/* Draft presets (auto-imported, not yet verified) */}
        {draft && (
          <Badge tone="neutral" className="shrink-0 !text-[9px]">
            draft
          </Badge>
        )}
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
