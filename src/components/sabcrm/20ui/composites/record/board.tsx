'use client';

/**
 * RecordBoard — the reusable kanban board for the SabCRM RecordSurface
 * (20ui composite).
 *
 * Headless-data + presentational: the caller owns the field system, fetching
 * and persistence; this component owns columns, cards, drag-and-drop and the
 * two record-engine extras:
 *
 *   - STAGE GATES — `canMove(record, toColumnId)` is consulted on drop (sync
 *     or async). A rejected drop snaps the card back to where it came from
 *     and surfaces the reason as a transient inline banner under the target
 *     column's header (self-contained — no toast dependency).
 *   - DEAL ROTTING — `rotting(record)` returns a 0..1 decay level. Rotting
 *     cards desaturate subtly with the level, show a clock indicator past
 *     0.5, and tint their border `var(--st-warn)` near 1.
 *
 * Drag-and-drop rides @dnd-kit (core 6.x / sortable 10.x): pointer dragging
 * with a 4px activation distance (so plain clicks still open cards), plus a
 * keyboard sensor — Space picks up / drops, arrows move, Escape cancels.
 * Enter is deliberately left out of the drag codes so it can open the card.
 *
 * Ordering is optimistic: cards land where they are dropped immediately and
 * `onMove(recordId, toColumnId, toIndex)` reports the intent (fired for
 * cross-column moves AND same-column reorders). When the caller's `records`
 * prop changes identity the board re-derives its buckets from props, so
 * server state always wins eventually.
 *
 * Columns scroll horizontally (min-width 280px) and cap rendering at 200
 * cards each with a "show more" tail. Records whose `groupKey` value matches
 * no column id are not rendered (the caller owns any "ungrouped" bucket by
 * declaring a column for it).
 *
 * Gotchas honoured: 20ui primitives are imported RELATIVELY (never through
 * the barrel — self-cycle), icon props go through the primitives' own
 * `renderIcon`, and all styling rides `--st-*` tokens (see board.css) so
 * dark mode is automatic. CSS classes are `.rb-*`, scoped under the 20ui
 * roots.
 */

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type KeyboardCodes,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Clock, Lock, Plus, ShieldAlert } from 'lucide-react';

import type { CrmRecord } from '@/lib/sabcrm/types';
import { Button, IconButton } from '../../button';
import { Skeleton } from '../../loading';
import { cn } from '../lib/cn';

import './board.css';

/* ------------------------------------------------------------- constants */

/** Cards rendered per column before the "show more" tail appears. */
const COLUMN_CARD_CAP = 200;
/** How many more cards each "show more" click reveals. */
const SHOW_MORE_STEP = 200;
/** Gate banners self-dismiss after this long (ms). */
const GATE_DISMISS_MS = 5000;
/** Rotting level past which the clock indicator appears. */
const ROT_CLOCK_AT = 0.5;
/** Rotting level past which the card border tints `--st-warn`. */
const ROT_HOT_AT = 0.85;
/** Skeleton columns shown while `loading`. */
const SKELETON_COLS = 4;

/**
 * Drag keyboard codes: Space picks up / drops, Escape cancels. Enter is NOT
 * a drag key so a focused card can still be opened with Enter.
 */
const BOARD_KEYBOARD_CODES: KeyboardCodes = {
  start: ['Space'],
  cancel: ['Escape'],
  end: ['Space'],
};

/** Fade the in-list placeholder while the overlay animates home. */
const DROP_ANIMATION: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
};

/* ----------------------------------------------------------------- types */

export interface RecordBoardColumn {
  /** Stable id — the `groupKey` value that buckets records into this column. */
  id: string;
  label: string;
  /** Concrete CSS color for the header dot (hex / rgb / var()). */
  color?: string;
  meta?: {
    /** Override for the header count (defaults to the bucketed card count). */
    count?: number;
    /** Pre-formatted aggregate shown right-aligned in the header (e.g. "₹4.2L"). */
    sumLabel?: string;
  };
}

export type RecordBoardGateKind = 'required-fields' | 'approval' | 'forbidden';

/** Verdict returned by `canMove` — a blocked drop snaps back + shows `reason`. */
export type RecordBoardGateVerdict =
  | { ok: true }
  | { ok: false; reason: string; kind?: RecordBoardGateKind };

/** Decay descriptor returned by `rotting` — `level` is clamped to 0..1. */
export interface RecordBoardRotting {
  level: number;
  /** Short label rendered beside the clock indicator (e.g. "12d idle"). */
  label?: string;
}

export interface RecordBoardProps {
  columns: RecordBoardColumn[];
  records: CrmRecord[];
  /** Field key (inside `record.data`) whose value buckets records into columns. */
  groupKey: string;
  /** Injected card renderer — the board never interprets field values itself. */
  renderCard: (record: CrmRecord) => React.ReactNode;
  /**
   * A card landed at `toIndex` inside `toColumnId` (optimistically already
   * applied). Fired for cross-column moves and same-column reorders alike.
   */
  onMove: (
    recordId: string,
    toColumnId: string,
    toIndex: number,
  ) => void | Promise<void>;
  /**
   * Stage gate, consulted before a CROSS-column drop commits (sync or async).
   * A `{ ok: false }` verdict snaps the card back and surfaces `reason` as a
   * transient banner under the target column's header.
   */
  canMove?: (
    record: CrmRecord,
    toColumnId: string,
  ) => RecordBoardGateVerdict | Promise<RecordBoardGateVerdict>;
  /**
   * Deal rotting: return a 0..1 decay level (or null for fresh records).
   * Subtle desaturation scales with level; a clock indicator appears past
   * 0.5; the border tints `var(--st-warn)` near 1.
   */
  rotting?: (record: CrmRecord) => RecordBoardRotting | null;
  onCardClick?: (record: CrmRecord) => void;
  /** Slot rendered pinned under a column (e.g. weighted sums). */
  columnFooter?: (column: RecordBoardColumn) => React.ReactNode;
  /** Shows a "+" affordance in each column header. */
  onAddCard?: (columnId: string) => void;
  loading?: boolean;
  /** Rendered instead of the columns when `records` is empty (and not loading). */
  emptyState?: React.ReactNode;
  className?: string;
}

/** A live gate-rejection banner (one at a time, on the offending column). */
interface GateNotice {
  columnId: string;
  reason: string;
  kind?: RecordBoardGateKind;
  /** Monotonic nonce so an identical repeat rejection restarts the timer. */
  nonce: number;
}

/* --------------------------------------------------------------- helpers */

type ColumnItems = Record<string, string[]>;

/** Bucket record ids into column-id keyed, ordered lists. */
function bucketRecords(
  records: CrmRecord[],
  columns: RecordBoardColumn[],
  groupKey: string,
): ColumnItems {
  const buckets: ColumnItems = {};
  for (const col of columns) buckets[col.id] = [];
  for (const rec of records) {
    const value = rec.data[groupKey];
    const key = value == null ? '' : String(value);
    if (buckets[key]) buckets[key].push(rec._id);
  }
  return buckets;
}

/** The column holding `id` — or `id` itself when it IS a column (droppable). */
function columnOf(map: ColumnItems, id: UniqueIdentifier): string | null {
  const key = String(id);
  if (key in map) return key;
  for (const colId of Object.keys(map)) {
    if (map[colId].indexOf(key) !== -1) return colId;
  }
  return null;
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/* ------------------------------------------------------------ component */

export function RecordBoard({
  columns,
  records,
  groupKey,
  renderCard,
  onMove,
  canMove,
  rotting,
  onCardClick,
  columnFooter,
  onAddCard,
  loading = false,
  emptyState,
  className,
}: RecordBoardProps): React.JSX.Element {
  const recordById = React.useMemo(() => {
    const map = new Map<string, CrmRecord>();
    for (const rec of records) map.set(rec._id, rec);
    return map;
  }, [records]);

  // Column buckets are the board's optimistic source of truth. They re-derive
  // whenever the inputs change identity (render-time reset, per React docs),
  // so the caller's persisted state always wins eventually.
  const [items, setItems] = React.useState<ColumnItems>(() =>
    bucketRecords(records, columns, groupKey),
  );
  const [synced, setSynced] = React.useState({ records, columns, groupKey });
  if (
    synced.records !== records ||
    synced.columns !== columns ||
    synced.groupKey !== groupKey
  ) {
    setSynced({ records, columns, groupKey });
    setItems(bucketRecords(records, columns, groupKey));
  }

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overColumnId, setOverColumnId] = React.useState<string | null>(null);
  const [gate, setGate] = React.useState<GateNotice | null>(null);
  /** Per-column reveal cap (column id → visible card count). */
  const [visibleCounts, setVisibleCounts] = React.useState<
    Record<string, number>
  >({});

  /** Bucket snapshot at drag start — restored on cancel / gate rejection. */
  const dragOriginRef = React.useRef<ColumnItems | null>(null);
  /** Suppresses the synthetic click that follows a drop. */
  const justDraggedRef = React.useRef(false);
  /** Invalidates in-flight async gate verdicts when a newer move lands. */
  const moveTokenRef = React.useRef(0);
  const gateNonceRef = React.useRef(0);

  // Gate banners self-dismiss.
  React.useEffect(() => {
    if (!gate) return;
    const t = window.setTimeout(() => setGate(null), GATE_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [gate]);

  const sensors = useSensors(
    // 4px activation distance keeps plain clicks (open card) drag-free.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: BOARD_KEYBOARD_CODES,
    }),
  );

  /* ---------------------------------------------------------- drag flow */

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      dragOriginRef.current = items;
      setActiveId(id);
      setOverColumnId(columnOf(items, id));
      setGate(null);
    },
    [items],
  );

  // Live cross-column preview: while dragging over another column, the card
  // is moved into it (dnd-kit's multi-container pattern) so the sortable gap
  // acts as the drop indicator. Pointer events arrive in separate tasks, so
  // the `items` closure is fresh per render (same shape as dnd-kit's own
  // multiple-containers example); the updater re-guards against races anyway.
  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) {
        setOverColumnId(null);
        return;
      }
      setOverColumnId(columnOf(items, over.id));
      setItems((prev) => {
        const fromCol = columnOf(prev, active.id);
        const toCol = columnOf(prev, over.id);
        if (!fromCol || !toCol || fromCol === toCol) return prev;

        const activeKey = String(active.id);
        const fromIds = prev[fromCol].filter((id) => id !== activeKey);
        const toIds = [...prev[toCol]];
        const overIndex = toIds.indexOf(String(over.id));

        let insertAt: number;
        if (String(over.id) === toCol) {
          // Hovering the column body (e.g. an empty column) → append.
          insertAt = toIds.length;
        } else {
          const isBelowOverItem =
            active.rect.current.translated != null &&
            active.rect.current.translated.top > over.rect.top + over.rect.height;
          insertAt = overIndex >= 0 ? overIndex + (isBelowOverItem ? 1 : 0) : toIds.length;
        }
        toIds.splice(Math.max(0, Math.min(insertAt, toIds.length)), 0, activeKey);
        return { ...prev, [fromCol]: fromIds, [toCol]: toIds };
      });
    },
    [items],
  );

  /** Snap a move back and raise the gate banner on the blocked column. */
  const rejectMove = React.useCallback(
    (origin: ColumnItems | null, columnId: string, verdict: { reason: string; kind?: RecordBoardGateKind }) => {
      if (origin) setItems(origin);
      gateNonceRef.current += 1;
      setGate({
        columnId,
        reason: verdict.reason,
        kind: verdict.kind,
        nonce: gateNonceRef.current,
      });
    },
    [],
  );

  /** Run the gate (sync or async) then commit or snap back. */
  const commitMove = React.useCallback(
    (
      record: CrmRecord,
      fromColumnId: string,
      toColumnId: string,
      toIndex: number,
      origin: ColumnItems | null,
    ) => {
      const token = ++moveTokenRef.current;
      const settle = (verdict: RecordBoardGateVerdict) => {
        if (verdict.ok) {
          void onMove(record._id, toColumnId, toIndex);
          return;
        }
        // A newer drag supersedes this verdict's snap-back (banner still shows).
        rejectMove(token === moveTokenRef.current ? origin : null, toColumnId, {
          reason: verdict.reason,
          kind: verdict.kind,
        });
      };
      if (canMove && fromColumnId !== toColumnId) {
        // Promise.resolve normalizes sync verdicts and promises alike; a sync
        // rejection snaps back one microtask later (imperceptible).
        Promise.resolve()
          .then(() => canMove(record, toColumnId))
          .then(settle, () =>
            settle({ ok: false, reason: 'Move validation failed.', kind: 'forbidden' }),
          );
      } else {
        settle({ ok: true });
      }
    },
    [canMove, onMove, rejectMove],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const origin = dragOriginRef.current;
      dragOriginRef.current = null;
      setActiveId(null);
      setOverColumnId(null);
      // The drop's pointerup dispatches a click synchronously; eat it.
      justDraggedRef.current = true;
      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);

      const id = String(active.id);
      const revert = () => {
        if (origin) setItems(origin);
      };
      if (!over) return revert();

      // After handleDragOver previews, the card already sits in its target
      // column; `origin` still knows where it came from.
      const toColumnId = columnOf(items, id);
      const fromColumnId = origin ? columnOf(origin, id) : toColumnId;
      if (!toColumnId || !fromColumnId) return revert();

      // Final same-column reorder against the drop target.
      let next = items;
      const overKey = String(over.id);
      if (columnOf(items, overKey) === toColumnId && overKey !== toColumnId) {
        const fromIndex = items[toColumnId].indexOf(id);
        const targetIndex = items[toColumnId].indexOf(overKey);
        if (fromIndex !== -1 && targetIndex !== -1 && fromIndex !== targetIndex) {
          next = {
            ...items,
            [toColumnId]: arrayMove(items[toColumnId], fromIndex, targetIndex),
          };
          setItems(next);
        }
      }

      const toIndex = next[toColumnId].indexOf(id);
      if (toIndex === -1) return revert();

      // No-op drop (same column, same order) → nothing to report.
      if (
        origin &&
        toColumnId === fromColumnId &&
        sameOrder(origin[toColumnId], next[toColumnId])
      ) {
        return;
      }

      const record = recordById.get(id);
      if (!record) return revert();
      commitMove(record, fromColumnId, toColumnId, toIndex, origin ?? null);
    },
    [items, recordById, commitMove],
  );

  const handleDragCancel = React.useCallback(() => {
    if (dragOriginRef.current) setItems(dragOriginRef.current);
    dragOriginRef.current = null;
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  /* -------------------------------------------------------- card events */

  const handleCardOpen = React.useCallback(
    (record: CrmRecord) => {
      if (justDraggedRef.current) return;
      onCardClick?.(record);
    },
    [onCardClick],
  );

  const handleShowMore = React.useCallback((columnId: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] ?? COLUMN_CARD_CAP) + SHOW_MORE_STEP,
    }));
  }, []);

  /* ------------------------------------------------------------- render */

  if (loading) {
    return (
      <div className={cn('rb', className)}>
        <div className="rb-scroll" aria-busy="true" aria-label="Loading board">
          {Array.from({ length: SKELETON_COLS }, (_, i) => (
            <div key={i} className="rb-col rb-col--skeleton">
              <div className="rb-col__head">
                <Skeleton width={8} circle />
                <Skeleton width={90} height={12} />
              </div>
              <div className="rb-col__list">
                {Array.from({ length: 3 - (i % 2) }, (_, j) => (
                  <Skeleton key={j} height={72} radius="var(--st-radius)" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (records.length === 0 && emptyState !== undefined) {
    return (
      <div className={cn('rb', className)}>
        <div className="rb-empty">{emptyState}</div>
      </div>
    );
  }

  const activeRecord = activeId ? recordById.get(activeId) ?? null : null;

  return (
    <div className={cn('rb', className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="rb-scroll">
          {columns.map((column) => (
            <BoardColumnView
              key={column.id}
              column={column}
              ids={items[column.id] ?? []}
              visibleCount={visibleCounts[column.id] ?? COLUMN_CARD_CAP}
              recordById={recordById}
              renderCard={renderCard}
              rotting={rotting}
              onOpen={onCardClick ? handleCardOpen : undefined}
              onAddCard={onAddCard}
              columnFooter={columnFooter}
              gate={gate && gate.columnId === column.id ? gate : null}
              isOver={overColumnId === column.id && activeId != null}
              onShowMore={handleShowMore}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={DROP_ANIMATION}>
          {activeRecord ? (
            <div className="rb-card rb-card--overlay">
              <div className="rb-card__content">{renderCard(activeRecord)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ---------------------------------------------------------------- column */

interface BoardColumnViewProps {
  column: RecordBoardColumn;
  ids: string[];
  visibleCount: number;
  recordById: Map<string, CrmRecord>;
  renderCard: (record: CrmRecord) => React.ReactNode;
  rotting?: (record: CrmRecord) => RecordBoardRotting | null;
  onOpen?: (record: CrmRecord) => void;
  onAddCard?: (columnId: string) => void;
  columnFooter?: (column: RecordBoardColumn) => React.ReactNode;
  gate: GateNotice | null;
  isOver: boolean;
  onShowMore: (columnId: string) => void;
}

const GATE_ICON: Record<RecordBoardGateKind, React.ReactNode> = {
  'required-fields': <AlertTriangle size={13} aria-hidden="true" />,
  approval: <ShieldAlert size={13} aria-hidden="true" />,
  forbidden: <Lock size={13} aria-hidden="true" />,
};

function BoardColumnView({
  column,
  ids,
  visibleCount,
  recordById,
  renderCard,
  rotting,
  onOpen,
  onAddCard,
  columnFooter,
  gate,
  isOver,
  onShowMore,
}: BoardColumnViewProps): React.JSX.Element {
  // Droppable on the column id so empty columns accept drops too.
  const { setNodeRef } = useDroppable({ id: column.id });

  const visibleIds = ids.length > visibleCount ? ids.slice(0, visibleCount) : ids;
  const hiddenCount = ids.length - visibleIds.length;
  const count = column.meta?.count ?? ids.length;
  const footer = columnFooter?.(column);

  return (
    <section
      className={cn('rb-col', isOver && 'rb-col--over')}
      aria-label={`${column.label}, ${count} ${count === 1 ? 'card' : 'cards'}`}
    >
      <header className="rb-col__head">
        <span
          className="rb-col__dot"
          style={{ background: column.color ?? 'var(--st-text-tertiary)' }}
          aria-hidden="true"
        />
        <h3 className="rb-col__label" title={column.label}>
          {column.label}
        </h3>
        <span className="rb-col__count">{count}</span>
        <span className="rb-col__tail">
          {column.meta?.sumLabel ? (
            <span className="rb-col__sum">{column.meta.sumLabel}</span>
          ) : null}
          {onAddCard ? (
            <IconButton
              size="sm"
              variant="ghost"
              className="rb-col__add"
              label={`Add card to ${column.label}`}
              icon={Plus}
              onClick={() => onAddCard(column.id)}
            />
          ) : null}
        </span>
      </header>

      {gate ? (
        <div
          key={gate.nonce}
          className={cn('rb-gate', gate.kind === 'forbidden' && 'rb-gate--forbidden')}
          role="status"
        >
          {GATE_ICON[gate.kind ?? 'required-fields']}
          <span className="rb-gate__reason">{gate.reason}</span>
        </div>
      ) : null}

      <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="rb-col__list">
          {visibleIds.map((id) => {
            const record = recordById.get(id);
            if (!record) return null;
            return (
              <BoardCardView
                key={id}
                id={id}
                record={record}
                renderCard={renderCard}
                rotting={rotting}
                onOpen={onOpen}
              />
            );
          })}
          {hiddenCount > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              block
              className="rb-col__more"
              onClick={() => onShowMore(column.id)}
            >
              Show {Math.min(hiddenCount, SHOW_MORE_STEP)} more ({hiddenCount} hidden)
            </Button>
          ) : null}
        </div>
      </SortableContext>

      {footer != null ? <div className="rb-col__footer">{footer}</div> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ card */

interface BoardCardViewProps {
  id: string;
  record: CrmRecord;
  renderCard: (record: CrmRecord) => React.ReactNode;
  rotting?: (record: CrmRecord) => RecordBoardRotting | null;
  onOpen?: (record: CrmRecord) => void;
}

function BoardCardView({
  id,
  record,
  renderCard,
  rotting,
  onOpen,
}: BoardCardViewProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const rot = rotting ? rotting(record) : null;
  const level = rot ? clamp01(rot.level) : 0;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Subtle decay: desaturate with the level (never below ~55% saturation).
  const contentStyle: React.CSSProperties | undefined =
    level > 0 ? { filter: `saturate(${(1 - 0.45 * level).toFixed(3)})` } : undefined;

  // The keyboard sensor owns Space (pick up / drop); Enter opens the card.
  const sortableKeyDown = listeners?.onKeyDown as
    | ((e: React.KeyboardEvent) => void)
    | undefined;
  const handleKeyDown = (e: React.KeyboardEvent) => {
    sortableKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' && onOpen && !isDragging) {
      e.preventDefault();
      onOpen(record);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rb-card',
        isDragging && 'is-dragging',
        level >= ROT_HOT_AT && 'rb-card--rot-hot',
      )}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={onOpen ? () => onOpen(record) : undefined}
      data-rb-card-id={id}
    >
      <div className="rb-card__content" style={contentStyle}>
        {renderCard(record)}
      </div>
      {rot && level > ROT_CLOCK_AT ? (
        <span className="rb-card__rot" title={rot.label ?? 'Going stale'}>
          <Clock size={11} aria-hidden="true" />
          {rot.label ? <span>{rot.label}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export default RecordBoard;
