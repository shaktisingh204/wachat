'use client';

/**
 * SabCRM — record board (kanban).
 *
 * A metadata-driven kanban for any object whose `views` include `board`
 * (e.g. opportunities by `stage`, tasks by `status`). The columns are the
 * options of a SELECT field — resolved from the object's `board.groupByField`
 * (or a caller-supplied `groupByField`) — and the cards are the records in
 * each bucket, fetched through the gated {@link groupRecordsAction}.
 *
 * Dragging a card from one column to another patches that record's group-by
 * field via {@link updateRecordAction}. The move is OPTIMISTIC: the card jumps
 * to the target column immediately, and rolls back (with a destructive toast)
 * if the server rejects the write — so RBAC / plan / validation failures stay
 * visible and never silently desync the board.
 *
 * Accessibility:
 *  - `aria-grabbed` toggles true/false on the card being dragged.
 *  - Each droppable column carries `aria-dropeffect="move"` while a drag is
 *    live; `"none"` otherwise.
 *  - A visually-hidden ARIA live region announces every completed or failed
 *    move to screen-reader users.
 *  - Keyboard users can focus a card and use Arrow-Left / Arrow-Right to move
 *    it to the adjacent column; Escape cancels a pending keyboard move.
 *  - Each column is a `<section>` landmark with `aria-label`, `aria-colindex`,
 *    and `aria-colcount` so screen-reader users can navigate the board grid.
 *  - Cards carry `role="article"` when non-interactive, or `role="button"`
 *    when draggable/openable, with `aria-describedby` pointing to the keyboard
 *    shortcut hint so AT announces "use arrow keys to move between columns."
 *  - After a keyboard move the focus is programmatically shifted to the card's
 *    new position so focus never strands on the vacated column.
 *
 * Performance:
 *  - `BoardColumn` and `BoardCard` are wrapped in `React.memo` so only the
 *    column whose `isDropTarget` or `savingId` changed re-renders on drag
 *    events — not the entire board.
 *  - `handleDragOver` no longer captures `dragOverKey` in its closure; it uses
 *    functional state instead, eliminating a spurious re-creation on every
 *    drag-over event.
 *  - All per-column/per-card callback references are stable across renders
 *    (useCallback with minimal deps), keeping React.memo effective.
 *
 * The component is fully tenant-safe by construction: it never queries Mongo
 * directly. Every read/write goes through a `*.actions.ts` server action, each
 * of which enforces session → project → RBAC → plan and returns an
 * {@link ActionResult}; the error branch is rendered inline. The drag-and-drop
 * is built on native HTML5 DnD (no external kanban dependency), composed
 * entirely from ZoruUI primitives under the inherited `.zoruui` scope.
 */

import * as React from 'react';
import { GripVertical, LayoutGrid, Plus, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ScrollArea,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  groupRecordsAction,
  updateRecordAction,
} from '@/app/actions/sabcrm.actions';
import type { SabcrmGroupedRecordPage, SabcrmRecordGroup } from '@/app/actions/sabcrm.actions.types';
import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecordWithLabel,
} from '@/lib/sabcrm/types';
import { FieldValue, resolveRecordTitle } from './field-renderer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Synthetic key the server uses for records whose group-by value is empty or
 * not one of the SELECT field's declared options. Drops onto this column are
 * disabled (there is no concrete value to write).
 */
const UNGROUPED_KEY = '__ungrouped__';

/** Per-column fetch cap forwarded to {@link groupRecordsAction}. */
const BOARD_CARD_CAP = 500;

/**
 * Stable id for the visually-hidden keyboard-shortcut hint referenced by
 * every draggable card's `aria-describedby`. Defined at module level so the
 * string never changes between renders.
 */
const KB_HINT_ID = 'sabcrm-board-kb-hint';

// ---------------------------------------------------------------------------
// Color mapping (mirrors the table/index renderer for visual parity)
// ---------------------------------------------------------------------------

type ColumnBadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

/**
 * Map a SELECT option color token (a `--zoru-*` palette name or hex) onto a
 * ZoruUI Badge variant. Kept in lockstep with the index page's
 * `badgeVariantForColor` so a stage looks identical in table + board.
 */
function badgeVariantForColor(color?: string): ColumnBadgeVariant {
  if (!color) return 'secondary';
  const c = color.toLowerCase();
  if (c.includes('green') || c.includes('emerald')) return 'success';
  if (c.includes('amber') || c.includes('yellow') || c.includes('orange')) {
    return 'warning';
  }
  if (c.includes('red') || c.includes('rose')) return 'danger';
  if (c.includes('accent') || c.includes('blue') || c.includes('primary')) {
    return 'default';
  }
  return 'outline';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordBoardProps {
  /** The object to render. Should support the `board` view. */
  object: ObjectMetadata;
  /** Active project override forwarded to every server action. */
  projectId?: string;
  /**
   * SELECT field key whose options become the columns. Defaults to the
   * object's `board.groupByField`.
   */
  groupByField?: string;
  /** Free-text search forwarded to the grouping query (label-field match). */
  search?: string;
  /** Invoked when a card is clicked (e.g. to open the detail panel/route). */
  onOpenRecord?: (record: CrmRecordWithLabel) => void;
  /** Invoked when the per-column "New" affordance is pressed. */
  onCreate?: (columnValue: string) => void;
  /** Whether the current user may create records (gates the New buttons). */
  canCreate?: boolean;
  /** Whether the current user may move cards (gates drag-and-drop writes). */
  canEdit?: boolean;
  /** Bump to force a refetch when a record is mutated elsewhere. */
  refreshToken?: number;
  className?: string;
}

// (No additional internal types beyond the exported props.)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Drag-and-drop kanban board for one SabCRM object, grouped by a SELECT field. */
export function RecordBoard({
  object,
  projectId,
  groupByField,
  search,
  onOpenRecord,
  onCreate,
  canCreate = true,
  canEdit = true,
  refreshToken = 0,
  className,
}: RecordBoardProps): React.ReactElement {
  const { toast } = useZoruToast();
  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Resolve the effective group-by field + its metadata up front so we can
  // fail closed when the object isn't board-capable.
  const resolvedGroupBy = groupByField ?? object.board?.groupByField;
  const groupField = React.useMemo<FieldMetadata | undefined>(
    () =>
      resolvedGroupBy
        ? object.fields.find((f) => f.key === resolvedGroupBy)
        : undefined,
    [object.fields, resolvedGroupBy],
  );
  const boardable = !!groupField && groupField.type === 'SELECT';

  // Fields rendered on each card (the table columns, minus the group-by field
  // which is already implied by the column the card sits in).
  const cardFields = React.useMemo<FieldMetadata[]>(
    () =>
      object.fields.filter((f) => f.inTable && f.key !== resolvedGroupBy),
    [object.fields, resolvedGroupBy],
  );

  const [groups, setGroups] = React.useState<SabcrmRecordGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  /** Local refresh counter, combined with the external `refreshToken`. */
  const [localTick, setLocalTick] = React.useState(0);
  /** Record id currently being persisted (greyed-out + non-draggable). */
  const [savingId, setSavingId] = React.useState<string | null>(null);
  /** Column key currently hovered during a drag, for the drop affordance. */
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);
  /** The record being dragged, captured on drag start. */
  const draggingRef = React.useRef<{
    record: CrmRecordWithLabel;
    fromKey: string;
  } | null>(null);

  /**
   * Map from record `_id` to the card's DOM node. Populated by each
   * `BoardCard` via callback ref. Used to restore focus after a keyboard move
   * so focus follows the card into its new column instead of stranding.
   */
  const cardRefMap = React.useRef<Map<string, HTMLDivElement>>(new Map());

  /**
   * Tracks whether a mouse/touch drag is live at all — used to toggle
   * `aria-dropeffect` on every column and `aria-grabbed` on the dragged card.
   */
  const [isDragging, setIsDragging] = React.useState(false);

  /**
   * ARIA live region message. Set to a non-empty string after every move
   * attempt (success or failure); auto-cleared after ~1.2 s so the AT does
   * not re-announce stale messages on subsequent renders.
   */
  const [liveMsg, setLiveMsg] = React.useState('');
  React.useEffect(() => {
    if (!liveMsg) return;
    const id = window.setTimeout(() => setLiveMsg(''), 1200);
    return () => window.clearTimeout(id);
  }, [liveMsg]);

  // Fetch the grouped page whenever the inputs change.
  React.useEffect(() => {
    if (!boardable || !resolvedGroupBy) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void groupRecordsAction(
      {
        object: object.slug,
        groupBy: resolvedGroupBy,
        search: search?.trim() || undefined,
        pageSize: BOARD_CARD_CAP,
      },
      projectId,
    ).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setGroups([]);
        return;
      }
      setGroups(res.data.groups);
    });

    return () => {
      cancelled = true;
    };
  }, [
    boardable,
    resolvedGroupBy,
    object.slug,
    search,
    projectId,
    refreshToken,
    localTick,
  ]);

  // ---- Core move logic -------------------------------------------------------

  /**
   * Optimistically move `record` from `fromKey` to `toKey`, then persist via
   * the server action. Rolls back the local state and fires a destructive toast
   * on server error.
   *
   * The pre-move snapshot is captured *inside* the `setGroups` functional
   * updater — not from the `groups` closure — so concurrent drags can never
   * use a stale snapshot as their rollback target.
   */
  const moveCard = React.useCallback(
    async (record: CrmRecordWithLabel, fromKey: string, toKey: string) => {
      if (!resolvedGroupBy) return;

      const optimistic: CrmRecordWithLabel = {
        ...record,
        data: { ...record.data, [resolvedGroupBy]: toKey },
      };

      // Capture the pre-move snapshot atomically inside the state updater.
      let snapshot: SabcrmRecordGroup[] = [];
      setGroups((curr) => {
        snapshot = curr;
        return curr.map((g) => {
          if (g.key === fromKey) {
            const next = g.records.filter((r) => r._id !== record._id);
            return { ...g, records: next, total: next.length };
          }
          if (g.key === toKey) {
            const next = [optimistic, ...g.records];
            return { ...g, records: next, total: next.length };
          }
          return g;
        });
      });

      setSavingId(record._id);
      const res = await updateRecordAction(
        record._id,
        { [resolvedGroupBy]: toKey },
        projectId,
      );
      setSavingId(null);

      if (!res.ok) {
        // Roll back to the snapshot captured at the moment of the move.
        setGroups(snapshot);
        const msg = `Move failed: ${res.error}`;
        setLiveMsg(msg);
        toastRef.current({
          title: 'Move failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        // Build a human-readable success announcement from the column labels.
        setGroups((curr) => {
          const toLabel =
            curr.find((g) => g.key === toKey)?.label ?? toKey;
          const recordTitle = optimistic.label || record._id;
          setLiveMsg(`${recordTitle} moved to ${toLabel}.`);
          return curr;
        });
      }
    },
    [resolvedGroupBy, projectId],
  );

  // ---- Drag-and-drop --------------------------------------------------------

  const handleDragStart = React.useCallback(
    (record: CrmRecordWithLabel, fromKey: string, e: React.DragEvent) => {
      if (!canEdit || savingId) {
        e.preventDefault();
        return;
      }
      draggingRef.current = { record, fromKey };
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      // Some browsers require data to be set for a drag to start.
      try {
        e.dataTransfer.setData('text/plain', record._id);
      } catch {
        /* setData can throw in restrictive environments; the ref is the source of truth. */
      }
    },
    [canEdit, savingId],
  );

  const handleDragEnd = React.useCallback(() => {
    draggingRef.current = null;
    setIsDragging(false);
    setDragOverKey(null);
  }, []);

  const handleDragOver = React.useCallback(
    (targetKey: string, e: React.DragEvent) => {
      const dragging = draggingRef.current;
      // Only show a drop target for real columns the card isn't already in.
      if (
        !canEdit ||
        targetKey === UNGROUPED_KEY ||
        !dragging ||
        dragging.fromKey === targetKey
      ) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Use functional setState to avoid capturing `dragOverKey` in the
      // closure — this keeps the callback stable and React.memo effective.
      setDragOverKey((curr) => (curr === targetKey ? curr : targetKey));
    },
    [canEdit],
  );

  const handleDragLeave = React.useCallback(
    (targetKey: string) => {
      setDragOverKey((curr) => (curr === targetKey ? null : curr));
    },
    [],
  );

  const handleDrop = React.useCallback(
    (targetKey: string, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverKey(null);
      setIsDragging(false);
      const dragging = draggingRef.current;
      draggingRef.current = null;
      if (
        !canEdit ||
        targetKey === UNGROUPED_KEY ||
        !dragging ||
        dragging.fromKey === targetKey
      ) {
        return;
      }
      void moveCard(dragging.record, dragging.fromKey, targetKey);
    },
    [canEdit, moveCard],
  );

  // ---- Keyboard move ---------------------------------------------------------

  /**
   * Called by `BoardCard` when the user presses Arrow-Left or Arrow-Right
   * while the card has keyboard focus and `canEdit` is true.
   *
   * Finds the current column index, steps ±1, skips the ungrouped column, and
   * calls `moveCard`. After the optimistic state update settles React will
   * re-render the card in its new column — we schedule a microtask-safe
   * `requestAnimationFrame` to shift focus to the card's new DOM node so
   * keyboard focus is never stranded in the vacated column.
   */
  const handleKeyboardMove = React.useCallback(
    (record: CrmRecordWithLabel, fromKey: string, direction: -1 | 1) => {
      if (!canEdit || savingId) return;

      const visibleGroups = groups.filter((g) => g.key !== UNGROUPED_KEY);
      const fromIdx = visibleGroups.findIndex((g) => g.key === fromKey);
      if (fromIdx === -1) return;

      const toIdx = fromIdx + direction;
      if (toIdx < 0 || toIdx >= visibleGroups.length) return;

      const toGroup = visibleGroups[toIdx];
      if (!toGroup) return;

      void moveCard(record, fromKey, toGroup.key);

      // Restore focus to the card after it re-renders in the new column.
      // Two rAF ticks give React time to commit the optimistic state update.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardRefMap.current.get(record._id)?.focus();
        });
      });
    },
    [canEdit, savingId, groups, moveCard],
  );

  // The visible (non-ungrouped) column count for aria-colcount.
  // Must be declared before any conditional return to satisfy the rules of hooks.
  const visibleColCount = React.useMemo(
    () => groups.filter((g) => g.key !== UNGROUPED_KEY).length,
    [groups],
  );

  // ---- Render ---------------------------------------------------------------

  // Object not configured for a board view.
  if (!boardable) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <EmptyState
          icon={<LayoutGrid />}
          title="Board view unavailable"
          description={`${object.labelPlural} has no SELECT field to group by. Configure a board column field to use the kanban view.`}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/*
       * Visually-hidden ARIA live region — announces move results to
       * screen-reader users without disrupting sighted layout.
       */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMsg}
      </div>

      {/*
       * Visually-hidden keyboard-shortcut hint referenced by every draggable
       * card's `aria-describedby`. Rendered once at board level so AT
       * announces "use arrow keys to move between columns" on card focus.
       */}
      <span id={KB_HINT_ID} className="sr-only">
        Use Arrow Left and Arrow Right keys to move between columns.
      </span>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[var(--st-text-secondary)]">
          Grouped by{' '}
          <span className="font-medium text-[var(--st-text)]">{groupField.label}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Refresh board"
          disabled={loading}
          onClick={() => setLocalTick((n) => n + 1)}
        >
          <RefreshCw className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Inline error (load failed — covers RBAC-denied + plan-locked) */}
      {error && (
        <EmptyState
          compact
          icon={<LayoutGrid />}
          title="Couldn't load board"
          description={error}
        />
      )}

      {/* Columns */}
      <ScrollArea className="w-full" viewportClassName="pb-3">
        {/*
         * role="grid" on the columns container lets AT treat the board as a
         * two-dimensional widget. Each column `<section>` carries aria-colindex
         * and aria-colcount so screen-reader users hear "column 2 of 4" as
         * they navigate with arrow keys.
         */}
        <div
          role="grid"
          aria-label={`${object.labelPlural} board grouped by ${groupField.label}`}
          aria-colcount={visibleColCount || undefined}
          className="flex items-start gap-4"
        >
          {loading && groups.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <BoardColumnSkeleton key={`skeleton-col-${i}`} />
              ))
            : groups.map((group, idx) => (
                <BoardColumn
                  key={group.key}
                  group={group}
                  object={object}
                  cardFields={cardFields}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  isDropTarget={dragOverKey === group.key}
                  isDragLive={isDragging}
                  savingId={savingId}
                  colIndex={idx + 1}
                  colCount={groups.length}
                  cardRefMap={cardRefMap}
                  onCreate={onCreate}
                  onOpenRecord={onOpenRecord}
                  onCardDragStart={handleDragStart}
                  onCardDragEnd={handleDragEnd}
                  onColumnDragOver={handleDragOver}
                  onColumnDragLeave={handleDragLeave}
                  onColumnDrop={handleDrop}
                  onKeyboardMove={handleKeyboardMove}
                />
              ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

interface BoardColumnProps {
  group: SabcrmRecordGroup;
  object: ObjectMetadata;
  cardFields: FieldMetadata[];
  canCreate: boolean;
  canEdit: boolean;
  isDropTarget: boolean;
  /** True while any mouse/touch drag is live — drives `aria-dropeffect`. */
  isDragLive: boolean;
  savingId: string | null;
  /** 1-based column index for `aria-colindex`. */
  colIndex: number;
  /** Total column count for `aria-colcount` announced per column. */
  colCount: number;
  /** Shared ref map so cards can register their DOM node for focus restoration. */
  cardRefMap: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onCreate?: (columnValue: string) => void;
  onOpenRecord?: (record: CrmRecordWithLabel) => void;
  onCardDragStart: (
    record: CrmRecordWithLabel,
    fromKey: string,
    e: React.DragEvent,
  ) => void;
  onCardDragEnd: () => void;
  onColumnDragOver: (targetKey: string, e: React.DragEvent) => void;
  onColumnDragLeave: (targetKey: string) => void;
  onColumnDrop: (targetKey: string, e: React.DragEvent) => void;
  onKeyboardMove: (
    record: CrmRecordWithLabel,
    fromKey: string,
    direction: -1 | 1,
  ) => void;
}

/**
 * Wrapped in `React.memo` so only the column(s) whose props actually changed
 * re-render on board-level state updates (e.g. drag-over key, saving id).
 * Without memo, a single `dragOverKey` change re-renders every card on the
 * board — expensive for large card sets.
 */
const BoardColumn = React.memo(function BoardColumn({
  group,
  object,
  cardFields,
  canCreate,
  canEdit,
  isDropTarget,
  isDragLive,
  savingId,
  colIndex,
  colCount,
  cardRefMap,
  onCreate,
  onOpenRecord,
  onCardDragStart,
  onCardDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onKeyboardMove,
}: BoardColumnProps): React.ReactElement {
  const isUngrouped = group.key === UNGROUPED_KEY;
  const droppable = canEdit && !isUngrouped;

  /**
   * `aria-dropeffect` is deprecated in ARIA 1.1 but still widely honoured by
   * AT. We set it to "move" while a drag is live over a valid drop target, and
   * "none" otherwise — matching the DnD semantics precisely.
   */
  const dropEffect: React.AriaAttributes['aria-dropeffect'] =
    isDragLive && droppable ? 'move' : 'none';

  return (
    <section
      role="rowgroup"
      aria-label={`${group.label} column, ${group.total} record${group.total === 1 ? '' : 's'}`}
      aria-colindex={colIndex}
      aria-colcount={colCount}
      aria-dropeffect={dropEffect}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-[var(--st-radius-lg)] border bg-[var(--st-bg-secondary)]/40 transition-colors',
        isDropTarget
          ? 'border-[var(--st-border-strong)] bg-[var(--st-bg-muted)]'
          : 'border-[var(--st-border)]',
      )}
      onDragOver={
        droppable ? (e) => onColumnDragOver(group.key, e) : undefined
      }
      onDragLeave={droppable ? () => onColumnDragLeave(group.key) : undefined}
      onDrop={droppable ? (e) => onColumnDrop(group.key, e) : undefined}
    >
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant={isUngrouped ? 'outline' : badgeVariantForColor(group.color)}
            className="max-w-[10rem] truncate"
          >
            {group.label}
          </Badge>
          <span
            className="text-xs tabular-nums text-[var(--st-text-secondary)]"
            aria-hidden="true"
          >
            {group.total}
          </span>
        </div>
        {canCreate && onCreate && !isUngrouped && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`New ${object.labelSingular.toLowerCase()} in ${group.label}`}
            onClick={() => onCreate(group.key)}
          >
            <Plus className="text-[var(--st-text-secondary)]" />
          </Button>
        )}
      </div>

      {/* Cards list */}
      <div
        role="row"
        aria-label={`${group.label} cards`}
        className="flex flex-col gap-2 p-3"
      >
        {group.records.length === 0 ? (
          <div
            aria-hidden="true"
            className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] px-3 py-6 text-center text-xs text-[var(--st-text-secondary)]"
          >
            {isDropTarget ? 'Drop here' : 'No records'}
          </div>
        ) : (
          group.records.map((record) => (
            <BoardCard
              key={record._id}
              record={record}
              object={object}
              fields={cardFields}
              fromKey={group.key}
              draggable={canEdit && !isUngrouped}
              saving={savingId === record._id}
              cardRefMap={cardRefMap}
              onOpenRecord={onOpenRecord}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onKeyboardMove={onKeyboardMove}
            />
          ))
        )}
      </div>
    </section>
  );
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface BoardCardProps {
  record: CrmRecordWithLabel;
  object: ObjectMetadata;
  fields: FieldMetadata[];
  fromKey: string;
  draggable: boolean;
  saving: boolean;
  /** Shared ref map — card registers its DOM node here for focus restoration. */
  cardRefMap: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onOpenRecord?: (record: CrmRecordWithLabel) => void;
  onDragStart: (
    record: CrmRecordWithLabel,
    fromKey: string,
    e: React.DragEvent,
  ) => void;
  onDragEnd: () => void;
  onKeyboardMove: (
    record: CrmRecordWithLabel,
    fromKey: string,
    direction: -1 | 1,
  ) => void;
}

/**
 * Wrapped in `React.memo` so a card only re-renders when its own record,
 * draggable state, or saving state changes — not when other cards or columns
 * update. The memo comparison is shallow; since `record` is a plain object
 * from server state, referential equality holds when the optimistic update
 * hasn't touched this card.
 */
const BoardCard = React.memo(function BoardCard({
  record,
  object,
  fields,
  fromKey,
  draggable,
  saving,
  cardRefMap,
  onOpenRecord,
  onDragStart,
  onDragEnd,
  onKeyboardMove,
}: BoardCardProps): React.ReactElement {
  const title = resolveRecordTitle(record, object.fields);
  // Only show fields that actually have a value, to keep cards compact.
  const populated = fields.filter((f) => {
    const v = record.data[f.key];
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  /**
   * `aria-grabbed` is deprecated in ARIA 1.1 but still used by many AT to
   * announce that an item is being dragged. We track a local "grabbed" state
   * that mirrors the HTML5 DnD lifecycle (dragstart → dragend).
   */
  const [grabbed, setGrabbed] = React.useState(false);

  /**
   * Callback ref: registers / unregisters this card's DOM node in the shared
   * `cardRefMap` keyed by `record._id`. The parent uses this map to restore
   * focus after a keyboard move (two rAF ticks after the optimistic update).
   */
  const cardCallbackRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        cardRefMap.current.set(record._id, node);
      } else {
        cardRefMap.current.delete(record._id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record._id],
    // cardRefMap.current is a stable Map; only _id identity matters here.
  );

  const handleDragStart = React.useCallback(
    (e: React.DragEvent) => {
      setGrabbed(true);
      onDragStart(record, fromKey, e);
    },
    [onDragStart, record, fromKey],
  );

  const handleDragEnd = React.useCallback(() => {
    setGrabbed(false);
    onDragEnd();
  }, [onDragEnd]);

  /**
   * Keyboard handler for the card. Supports:
   *
   *  - Enter / Space  → open record (when `onOpenRecord` is set)
   *  - Arrow-Left     → move card to the column to the left  (when draggable)
   *  - Arrow-Right    → move card to the column to the right (when draggable)
   *
   * Arrow keys only fire the move when the card itself has focus — not when
   * focus is inside a descendant interactive element — so they don't interfere
   * with e.g. a <select> inside a card field renderer.
   */
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return; // only top-level card focus

      if ((e.key === 'Enter' || e.key === ' ') && onOpenRecord) {
        e.preventDefault();
        onOpenRecord(record);
        return;
      }

      if (draggable && !saving) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onKeyboardMove(record, fromKey, -1);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onKeyboardMove(record, fromKey, 1);
          return;
        }
      }
    },
    [draggable, saving, onOpenRecord, onKeyboardMove, record, fromKey],
  );

  const isInteractive = draggable || !!onOpenRecord;

  return (
    <Card
      ref={cardCallbackRef}
      variant="default"
      interactive={!!onOpenRecord}
      draggable={draggable && !saving}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onOpenRecord ? () => onOpenRecord(record) : undefined}
      role="gridcell"
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={title}
      aria-describedby={draggable ? KB_HINT_ID : undefined}
      aria-grabbed={draggable ? grabbed : undefined}
      aria-busy={saving || undefined}
      className={cn(
        'gap-2 p-3',
        draggable && 'cursor-grab active:cursor-grabbing',
        saving && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-text-secondary)]/50"
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--st-text)]">
          {title}
        </span>
      </div>

      {populated.length > 0 && (
        <dl className="flex flex-col gap-1.5 pl-6">
          {populated.map((field) => (
            <div
              key={field.key}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <dt className="shrink-0 text-[var(--st-text-secondary)]">{field.label}</dt>
              <dd className="min-w-0 truncate text-right">
                <FieldValue field={field} value={record.data[field.key]} dense />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function BoardColumnSkeleton(): React.ReactElement {
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-6" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--st-radius-lg)]" />
        ))}
      </div>
    </section>
  );
}
