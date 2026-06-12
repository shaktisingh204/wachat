'use client';

/**
 * RecordGrid — the reusable, virtualized record table for the SabCRM
 * RecordSurface (20ui composite).
 *
 * Headless-data + presentational: the caller owns fetching, paging, sorting
 * and the field system; this component owns rendering 36px-dense rows fast.
 *
 *  - Rows are virtualized with `@tanstack/react-virtual` (container scroll),
 *    so 5,000+ loaded rows render only a viewport-sized window.
 *  - Sticky header, leading checkbox selection column (header = select-all
 *    for the CURRENT page of `records`), sort toggle (asc → desc → none),
 *    pointer-driven column resize (min 80px), and keyboard navigation
 *    (Up/Down to move, Enter to open, Space to toggle selection).
 *  - Cells are rendered by the injected `renderCell` — the grid never
 *    interprets field values itself.
 *
 * A11y: ARIA grid semantics (`grid` → `rowgroup` → `row` → `columnheader` /
 * `gridcell`), `aria-sort` on headers, `aria-selected` on rows, a roving
 * tabindex over the rows and a visible token-driven focus ring.
 *
 * Gotchas honoured: 20ui primitives are imported RELATIVELY (never through
 * the barrel — self-cycle), and all styling rides `--st-*` / `--u-*` tokens
 * (see record-grid.css) so dark mode is automatic.
 */

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import { Checkbox } from '../../choice';
import { Skeleton } from '../../loading';
import { cn } from '../lib/cn';

import './record-grid.css';

/* ------------------------------------------------------------- constants */

/** Default row height (px). Must match `--rg-row-h` in record-grid.css; the
 *  live value is re-read from CSS at mount so density overrides stay true. */
const DEFAULT_ROW_HEIGHT = 36;
/** Rows rendered beyond the viewport so fast scrolls never flash blank. */
const OVERSCAN = 12;
/** Column-resize clamps (px) — grabbable but never collapsed. */
const COL_MIN_WIDTH = 80;
const COL_MAX_WIDTH = 640;
/** Width used for any column without an explicit `columnWidths` entry. */
const DEFAULT_COL_WIDTH = 160;
/** The leading checkbox column's fixed width (px). */
const CHECK_COL_WIDTH = 36;
/** Skeleton rows shown while `loading` with no records yet. */
const SKELETON_ROWS = 8;

/* ----------------------------------------------------------------- types */

export interface RecordGridSort {
  key: string;
  dir: 'asc' | 'desc';
}

export interface RecordGridSelection {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export interface RecordGridProps {
  /** Drives labels / accessible names (column metadata lives in `fields`). */
  object: ObjectMetadata;
  /** Visible columns, in order. */
  fields: FieldMetadata[];
  /** The current page of rows. */
  records: CrmRecord[];
  /** Total row count across all pages (feeds `aria-rowcount`). */
  total?: number;
  loading?: boolean;
  /** Injected cell renderer — the field system is built separately. */
  renderCell: (record: CrmRecord, field: FieldMetadata) => React.ReactNode;
  onRowClick?: (record: CrmRecord) => void;
  /** Controlled selection. Omit to hide the checkbox column. */
  selection?: RecordGridSelection;
  sort?: RecordGridSort | null;
  /** Enables header sort toggles (asc → desc → none). */
  onSortChange?: (s: RecordGridSort | null) => void;
  /** Fired once per resize gesture, on release, with the clamped width. */
  onColumnResize?: (key: string, px: number) => void;
  /** Controlled column widths (px), keyed by field key. */
  columnWidths?: Record<string, number>;
  emptyState?: React.ReactNode;
  /** Pagination slot, rendered below the scroll area. */
  footer?: React.ReactNode;
  className?: string;
}

/* ------------------------------------------------------------ component */

export function RecordGrid({
  object,
  fields,
  records,
  total,
  loading = false,
  renderCell,
  onRowClick,
  selection,
  sort,
  onSortChange,
  onColumnResize,
  columnWidths,
  emptyState,
  footer,
  className,
}: RecordGridProps): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  /* ----- Row height: CSS is the source of truth (`--rg-row-h`), re-read at
     mount so `.st-density-compact` and the JS row estimate cannot drift. */
  const [rowHeight, setRowHeight] = React.useState(DEFAULT_ROW_HEIGHT);
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const raw = window
      .getComputedStyle(el)
      .getPropertyValue('--rg-row-h')
      .trim();
    const px = Number.parseFloat(raw);
    if (Number.isFinite(px) && px > 0) {
      setRowHeight(px);
    }
  }, []);

  /* ----- Virtualizer (container-scroll based). */
  const estimateSize = React.useCallback(() => rowHeight, [rowHeight]);
  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: OVERSCAN,
    // The sticky header occupies one row height at the top of the scroll
    // viewport — keep scrollToIndex targets from hiding underneath it.
    scrollPaddingStart: rowHeight,
  });
  // A density change invalidates every cached row measurement.
  React.useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight]);

  /* ----- Column widths: controlled via `columnWidths`, with a transient
     local override while a resize gesture is live so dragging feels
     instant; the clamped width is committed via `onColumnResize` on release. */
  const [liveResize, setLiveResize] = React.useState<{
    key: string;
    width: number;
  } | null>(null);
  const resizeRef = React.useRef<{
    key: string;
    startX: number;
    startWidth: number;
    width: number;
  } | null>(null);

  const widthOf = React.useCallback(
    (key: string): number => {
      if (liveResize?.key === key) return liveResize.width;
      const w = columnWidths?.[key];
      return w != null
        ? Math.min(COL_MAX_WIDTH, Math.max(COL_MIN_WIDTH, w))
        : DEFAULT_COL_WIDTH;
    },
    [columnWidths, liveResize],
  );

  const hasSelection = Boolean(selection);
  const totalWidth =
    (hasSelection ? CHECK_COL_WIDTH : 0) +
    fields.reduce((sum, f) => sum + widthOf(f.key), 0);

  const handleResizeStart = (
    e: React.PointerEvent<HTMLElement>,
    key: string,
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = widthOf(key);
    resizeRef.current = { key, startX: e.clientX, startWidth, width: startWidth };
    setLiveResize({ key, width: startWidth });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLElement>): void => {
    const drag = resizeRef.current;
    if (!drag) return;
    const next = Math.min(
      COL_MAX_WIDTH,
      Math.max(COL_MIN_WIDTH, drag.startWidth + (e.clientX - drag.startX)),
    );
    if (next !== drag.width) {
      drag.width = next;
      setLiveResize({ key: drag.key, width: next });
    }
  };

  const handleResizeEnd = (): void => {
    const drag = resizeRef.current;
    if (!drag) return;
    resizeRef.current = null;
    setLiveResize(null);
    onColumnResize?.(drag.key, drag.width);
  };

  /* ----- Selection (current page). */
  const selected = selection?.selected;
  const pageIds = React.useMemo(() => records.map((r) => r._id), [records]);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected?.has(id));
  const someSelected = pageIds.some((id) => selected?.has(id));

  const toggleAll = (): void => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allSelected) {
      for (const id of pageIds) next.delete(id);
    } else {
      for (const id of pageIds) next.add(id);
    }
    selection.onChange(next);
  };

  const toggleOne = (id: string): void => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  /* ----- Sort: header click cycles asc → desc → none. */
  const cycleSort = (key: string): void => {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, dir: 'asc' });
    else if (sort.dir === 'asc') onSortChange({ key, dir: 'desc' });
    else onSortChange(null);
  };

  /* ----- Keyboard navigation: roving tabindex over rows. */
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const rowEls = React.useRef(new Map<number, HTMLDivElement>());
  const pendingFocus = React.useRef(false);

  const moveActive = (index: number): void => {
    const clamped = Math.max(0, Math.min(records.length - 1, index));
    pendingFocus.current = true;
    setActiveIndex(clamped);
    virtualizer.scrollToIndex(clamped);
  };

  React.useEffect(() => {
    if (!pendingFocus.current || activeIndex == null) return;
    pendingFocus.current = false;
    const focusRow = (): void => {
      rowEls.current.get(activeIndex)?.focus({ preventScroll: true });
    };
    const el = rowEls.current.get(activeIndex);
    if (el) el.focus({ preventScroll: true });
    // Row may mount on the virtualizer's next frame after scrollToIndex.
    else window.requestAnimationFrame(focusRow);
  }, [activeIndex]);

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    // Only act when the row itself has focus — let checkboxes / header sort
    // buttons keep their native key behaviour.
    const target = e.target as HTMLElement;
    if (!target.classList.contains('rg-row')) return;
    const index = Number(target.dataset.index);
    if (!Number.isFinite(index)) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(index + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        moveActive(0);
        break;
      case 'End':
        e.preventDefault();
        moveActive(records.length - 1);
        break;
      case 'Enter': {
        e.preventDefault();
        const record = records[index];
        if (record) onRowClick?.(record);
        break;
      }
      case ' ': {
        if (!selection) break;
        e.preventDefault();
        const record = records[index];
        if (record) toggleOne(record._id);
        break;
      }
      default:
        break;
    }
  };

  /* ----- Render. */
  const virtualItems = virtualizer.getVirtualItems();
  const firstRendered = virtualItems[0]?.index ?? 0;
  const lastRendered = virtualItems[virtualItems.length - 1]?.index ?? -1;
  const tabStop =
    activeIndex != null &&
    activeIndex >= firstRendered &&
    activeIndex <= lastRendered
      ? activeIndex
      : firstRendered;

  const colOffset = hasSelection ? 1 : 0;
  const showSkeleton = loading && records.length === 0;
  const showEmpty = !loading && records.length === 0;
  const refreshing = loading && records.length > 0;

  return (
    <div
      ref={rootRef}
      className={cn('rg', refreshing && 'is-refreshing', className)}
    >
      <div
        ref={scrollRef}
        className="rg-scroll"
        role="grid"
        aria-label={object.labelPlural}
        aria-busy={loading || undefined}
        aria-rowcount={(total ?? records.length) + 1}
        aria-colcount={fields.length + colOffset}
        onKeyDown={handleGridKeyDown}
      >
        {/* Header */}
        <div className="rg-head" role="rowgroup">
          <div className="rg-hrow" role="row" aria-rowindex={1}>
            {hasSelection ? (
              <div
                className="rg-th rg-th--check"
                role="columnheader"
                aria-colindex={1}
                style={{ flex: `0 0 ${CHECK_COL_WIDTH}px` }}
              >
                <Checkbox
                  size="sm"
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={toggleAll}
                  aria-label={`Select all ${object.labelPlural}`}
                />
              </div>
            ) : null}
            {fields.map((field, i) => {
              const isSorted = sort?.key === field.key;
              const dir = isSorted ? sort?.dir : null;
              const ariaSort: React.AriaAttributes['aria-sort'] = onSortChange
                ? dir === 'asc'
                  ? 'ascending'
                  : dir === 'desc'
                    ? 'descending'
                    : 'none'
                : undefined;
              const isLast = i === fields.length - 1;
              return (
                <div
                  key={field.key}
                  className={cn('rg-th', isSorted && 'is-sorted')}
                  role="columnheader"
                  aria-colindex={i + 1 + colOffset}
                  aria-sort={ariaSort}
                  style={{
                    flex: `${isLast ? 1 : 0} 0 ${widthOf(field.key)}px`,
                  }}
                >
                  {onSortChange ? (
                    <button
                      type="button"
                      className="rg-th-sort"
                      onClick={() => cycleSort(field.key)}
                      title={`Sort by ${field.label}`}
                    >
                      <span className="rg-th-label">{field.label}</span>
                      <SortCaret dir={dir ?? null} />
                    </button>
                  ) : (
                    <span className="rg-th-label">{field.label}</span>
                  )}
                  {onColumnResize ? (
                    <span
                      className={cn(
                        'rg-resize',
                        liveResize?.key === field.key && 'is-active',
                      )}
                      aria-hidden="true"
                      onPointerDown={(e) => handleResizeStart(e, field.key)}
                      onPointerMove={handleResizeMove}
                      onPointerUp={handleResizeEnd}
                      onPointerCancel={handleResizeEnd}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {showSkeleton ? (
          <div role="presentation">
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={i} className="rg-skel-row">
                {hasSelection ? <Skeleton width={14} height={14} /> : null}
                {fields.map((f, j) => (
                  <Skeleton
                    key={f.key}
                    width={Math.max(48, widthOf(f.key) * (0.45 + ((i + j) % 3) * 0.15))}
                    height={12}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <div role="presentation">
            {emptyState ?? (
              <div className="rg-empty">
                <span className="rg-empty-chip" aria-hidden="true">
                  <Inbox size={20} />
                </span>
                <p className="rg-empty-title">No {object.labelPlural.toLowerCase()} yet</p>
                <p className="rg-empty-desc">
                  New {object.labelPlural.toLowerCase()} will appear here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rg-body"
            role="rowgroup"
            style={{
              height: virtualizer.getTotalSize(),
              width: totalWidth,
              minWidth: '100%',
            }}
          >
            {virtualItems.map((vi) => {
              const record = records[vi.index];
              if (!record) return null;
              const isSelected = selected?.has(record._id) ?? false;
              return (
                <div
                  key={record._id}
                  ref={(el) => {
                    if (el) rowEls.current.set(vi.index, el);
                    else rowEls.current.delete(vi.index);
                  }}
                  className={cn(
                    'rg-row',
                    isSelected && 'is-selected',
                    onRowClick && 'is-clickable',
                  )}
                  role="row"
                  aria-rowindex={vi.index + 2}
                  aria-selected={hasSelection ? isSelected : undefined}
                  data-index={vi.index}
                  tabIndex={vi.index === tabStop ? 0 : -1}
                  style={{
                    height: vi.size,
                    transform: `translateY(${vi.start}px)`,
                  }}
                  onClick={() => {
                    setActiveIndex(vi.index);
                    onRowClick?.(record);
                  }}
                  onFocus={() => setActiveIndex(vi.index)}
                >
                  {hasSelection ? (
                    <div
                      className="rg-cell rg-cell--check"
                      role="gridcell"
                      aria-colindex={1}
                      style={{ flex: `0 0 ${CHECK_COL_WIDTH}px` }}
                    >
                      <Checkbox
                        size="sm"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleOne(record._id)}
                        aria-label={`Select ${object.labelSingular}`}
                      />
                    </div>
                  ) : null}
                  {fields.map((field, i) => (
                    <div
                      key={field.key}
                      className="rg-cell"
                      role="gridcell"
                      aria-colindex={i + 1 + colOffset}
                      style={{
                        flex: `${i === fields.length - 1 ? 1 : 0} 0 ${widthOf(field.key)}px`,
                      }}
                    >
                      {renderCell(record, field)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {footer ? <div className="rg-footer">{footer}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- internals */

/** Directional caret in a sortable header. Decorative. */
function SortCaret({ dir }: { dir: 'asc' | 'desc' | null }): React.JSX.Element {
  const Icon: LucideIcon =
    dir === 'asc' ? ChevronUp : dir === 'desc' ? ChevronDown : ChevronsUpDown;
  return <Icon size={13} className="rg-th-caret" aria-hidden="true" />;
}

export default RecordGrid;
