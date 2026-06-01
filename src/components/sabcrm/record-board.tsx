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
 * to the target column immediately, and only rolls back (with an inline toast)
 * if the server rejects the write — so RBAC / plan / validation failures stay
 * visible and never silently desync the board.
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
} from '@/components/zoruui';
import {
  groupRecordsAction,
  updateRecordAction,
  type SabcrmGroupedRecordPage,
  type SabcrmRecordGroup,
} from '@/app/actions/sabcrm.actions';
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

  // ---- Drag-and-drop --------------------------------------------------------

  const handleDragStart = React.useCallback(
    (record: CrmRecordWithLabel, fromKey: string, e: React.DragEvent) => {
      if (!canEdit || savingId) {
        e.preventDefault();
        return;
      }
      draggingRef.current = { record, fromKey };
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
      if (dragOverKey !== targetKey) setDragOverKey(targetKey);
    },
    [canEdit, dragOverKey],
  );

  const handleDragLeave = React.useCallback(
    (targetKey: string) => {
      setDragOverKey((curr) => (curr === targetKey ? null : curr));
    },
    [],
  );

  const moveCard = React.useCallback(
    async (record: CrmRecordWithLabel, fromKey: string, toKey: string) => {
      if (!resolvedGroupBy) return;

      // Snapshot for rollback.
      const snapshot = groups;
      const optimistic: CrmRecordWithLabel = {
        ...record,
        data: { ...record.data, [resolvedGroupBy]: toKey },
      };

      // Optimistically move the card between buckets + adjust counts.
      setGroups((curr) =>
        curr.map((g) => {
          if (g.key === fromKey) {
            const next = g.records.filter((r) => r._id !== record._id);
            return { ...g, records: next, total: next.length };
          }
          if (g.key === toKey) {
            const next = [optimistic, ...g.records];
            return { ...g, records: next, total: next.length };
          }
          return g;
        }),
      );

      setSavingId(record._id);
      const res = await updateRecordAction(
        record._id,
        { [resolvedGroupBy]: toKey },
        projectId,
      );
      setSavingId(null);

      if (!res.ok) {
        // Roll back to the pre-drag arrangement and surface the error.
        setGroups(snapshot);
        toastRef.current({
          title: 'Move failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [groups, resolvedGroupBy, projectId],
  );

  const handleDrop = React.useCallback(
    (targetKey: string, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverKey(null);
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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zoru-ink-muted">
          Grouped by{' '}
          <span className="font-medium text-zoru-ink">{groupField.label}</span>
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
          title="Couldn’t load board"
          description={error}
        />
      )}

      {/* Columns */}
      <ScrollArea className="w-full" viewportClassName="pb-3">
        <div className="flex items-start gap-4">
          {loading && groups.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <BoardColumnSkeleton key={`skeleton-${i}`} />
              ))
            : groups.map((group) => (
                <BoardColumn
                  key={group.key}
                  group={group}
                  object={object}
                  cardFields={cardFields}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  isDropTarget={dragOverKey === group.key}
                  savingId={savingId}
                  onCreate={onCreate}
                  onOpenRecord={onOpenRecord}
                  onCardDragStart={handleDragStart}
                  onCardDragEnd={handleDragEnd}
                  onColumnDragOver={handleDragOver}
                  onColumnDragLeave={handleDragLeave}
                  onColumnDrop={handleDrop}
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
  savingId: string | null;
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
}

function BoardColumn({
  group,
  object,
  cardFields,
  canCreate,
  canEdit,
  isDropTarget,
  savingId,
  onCreate,
  onOpenRecord,
  onCardDragStart,
  onCardDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
}: BoardColumnProps): React.ReactElement {
  const isUngrouped = group.key === UNGROUPED_KEY;
  const droppable = canEdit && !isUngrouped;

  return (
    <section
      aria-label={`${group.label} column`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-[var(--zoru-radius-lg)] border bg-zoru-surface/40 transition-colors',
        isDropTarget
          ? 'border-zoru-line-strong bg-zoru-surface-2'
          : 'border-zoru-line',
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
          <span className="text-xs tabular-nums text-zoru-ink-muted">
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
            <Plus className="text-zoru-ink-muted" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-3">
        {group.records.length === 0 ? (
          <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line px-3 py-6 text-center text-xs text-zoru-ink-muted">
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
              onOpenRecord={onOpenRecord}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
            />
          ))
        )}
      </div>
    </section>
  );
}

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
  onOpenRecord?: (record: CrmRecordWithLabel) => void;
  onDragStart: (
    record: CrmRecordWithLabel,
    fromKey: string,
    e: React.DragEvent,
  ) => void;
  onDragEnd: () => void;
}

function BoardCard({
  record,
  object,
  fields,
  fromKey,
  draggable,
  saving,
  onOpenRecord,
  onDragStart,
  onDragEnd,
}: BoardCardProps): React.ReactElement {
  const title = resolveRecordTitle(record, object.fields);
  // Only show fields that actually have a value, to keep cards compact.
  const populated = fields.filter((f) => {
    const v = record.data[f.key];
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  return (
    <Card
      variant="default"
      interactive={!!onOpenRecord}
      draggable={draggable}
      onDragStart={(e) => onDragStart(record, fromKey, e)}
      onDragEnd={onDragEnd}
      onClick={onOpenRecord ? () => onOpenRecord(record) : undefined}
      role={onOpenRecord ? 'button' : undefined}
      tabIndex={onOpenRecord ? 0 : undefined}
      onKeyDown={
        onOpenRecord
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenRecord(record);
              }
            }
          : undefined
      }
      aria-label={title}
      className={cn(
        'gap-2 p-3',
        draggable && 'cursor-grab active:cursor-grabbing',
        saving && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical
            className="mt-0.5 h-4 w-4 shrink-0 text-zoru-ink-muted/50"
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zoru-ink">
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
              <dt className="shrink-0 text-zoru-ink-muted">{field.label}</dt>
              <dd className="min-w-0 truncate text-right">
                <FieldValue field={field} value={record.data[field.key]} dense />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function BoardColumnSkeleton(): React.ReactElement {
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface/40">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-6" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--zoru-radius-lg)]" />
        ))}
      </div>
    </section>
  );
}
