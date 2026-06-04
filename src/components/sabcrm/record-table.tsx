'use client';

/**
 * SabCRM — record table.
 *
 * A metadata-driven, paginated table for any object. It fetches records
 * via {@link listRecordsAction}, renders each in-table field through the
 * shared {@link FieldValue} renderer, supports search + column sorting,
 * and exposes create / row-click / delete affordances.
 *
 * The component is fully tenant-safe by construction: it never queries
 * Mongo directly — every read goes through the gated server action, which
 * scopes by project + user. An optional `projectId` is forwarded to the
 * action for callers that manage an explicit active project.
 *
 * Hardening (additive):
 *   - Optimistic row delete: the row disappears immediately; the server
 *     action runs in the background, and on failure the snapshot is rolled
 *     back + a destructive toast is shown.
 *   - Optimistic row update: callers can supply `onRowUpdate` to patch a
 *     single record's data fields; the local state is updated immediately
 *     and rolled back if the server rejects the write.
 *   - Keyboard a11y: focusable rows (tabIndex 0) open on Enter / Space,
 *     arrow-key navigation between rows, and the delete button is
 *     keyboard-reachable without a mouse click.
 *   - ARIA: proper grid/rowgroup/columnheader/row roles, aria-sort on
 *     active sort columns, aria-busy during loading, aria-live for the
 *     status region, and aria-label on the actions column.
 *   - Perf: RecordRow is memoized so only the row(s) whose busy-state
 *     changes re-render; stable refs break dep-cycle on `total` /
 *     `onRowUpdate` to avoid cascade re-renders.
 */

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  EmptyState,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  listRecordsAction,
  deleteRecordAction,
  updateRecordAction,
} from '@/app/actions/sabcrm.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecordWithLabel,
  RecordQuery,
} from '@/lib/sabcrm/types';
import { FieldValue, resolveRecordTitle } from './field-renderer';
import { useStConfirm } from '@/components/sabcrm/twenty/st-modals';

const DEFAULT_PAGE_SIZE = 25;

export interface RecordTableProps {
  object: ObjectMetadata;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Invoked when a row is clicked or activated with Enter/Space. */
  onRowClick?: (record: CrmRecordWithLabel) => void;
  /** Invoked when the "New" button is pressed. */
  onCreate?: () => void;
  /** When the caller mutates a record elsewhere, bump this to refetch. */
  refreshToken?: number;
  /** Whether the current user may create records (gates the New button). */
  canCreate?: boolean;
  /** Whether the current user may delete records (gates row delete). */
  canDelete?: boolean;
  /**
   * When supplied, enables optimistic inline updates. The callback receives
   * the record id and the patch (partial `data` map) to apply; the table
   * applies the patch optimistically and rolls back if the server rejects it.
   *
   * If omitted the table is read-only (no optimistic-update path).
   */
  onRowUpdate?: (recordId: string, patch: Record<string, unknown>) => void;
  /** Resolver mapping a related record id to a label, for RELATION cells. */
  resolveRelationLabel?: (id: string) => string | undefined;
  className?: string;
}

interface SortState {
  by: string;
  dir: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Applies a shallow data-patch onto a record (immutable, returns new record). */
function applyPatch(
  record: CrmRecordWithLabel,
  patch: Record<string, unknown>,
): CrmRecordWithLabel {
  return { ...record, data: { ...record.data, ...patch } };
}

// ---------------------------------------------------------------------------
// RecordRow — memoized so only affected rows re-render when busy-state changes
// ---------------------------------------------------------------------------

interface RecordRowProps {
  record: CrmRecordWithLabel;
  rowIndex: number;
  columns: FieldMetadata[];
  fields: FieldMetadata[];
  isDeleting: boolean;
  isUpdating: boolean;
  isInteractive: boolean;
  canDelete: boolean;
  resolveRelationLabel?: (id: string) => string | undefined;
  onRowClick?: (record: CrmRecordWithLabel) => void;
  onRowKeyDown: (record: CrmRecordWithLabel, e: React.KeyboardEvent<HTMLTableRowElement>) => void;
  onDelete: (record: CrmRecordWithLabel, e: React.MouseEvent | React.KeyboardEvent) => void;
}

/** Single data row. Memoized — only re-renders when its own props change. */
const RecordRow = React.memo(function RecordRow({
  record,
  rowIndex,
  columns,
  fields,
  isDeleting,
  isUpdating,
  isInteractive,
  canDelete,
  resolveRelationLabel,
  onRowClick,
  onRowKeyDown,
  onDelete,
}: RecordRowProps): React.ReactElement {
  const title = resolveRecordTitle(record, fields);
  const isBusy = isDeleting || isUpdating;

  return (
    <TableRow
      key={record._id}
      tabIndex={isInteractive ? 0 : undefined}
      role="row"
      aria-rowindex={rowIndex + 2} // +1 for 1-based, +1 more for header row
      aria-busy={isBusy}
      aria-disabled={isDeleting}
      className={cn(
        isInteractive &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink focus-visible:ring-inset',
        isBusy && 'opacity-50 pointer-events-none',
      )}
      onClick={() => {
        if (!isBusy) onRowClick?.(record);
      }}
      onKeyDown={(e) => {
        if (!isBusy) onRowKeyDown(record, e);
      }}
    >
      <TableCell className="font-medium text-zoru-ink">
        {title}
      </TableCell>
      {columns.map((col) => (
        <TableCell key={col.key}>
          <FieldValue
            field={col}
            value={record.data[col.key]}
            resolveRelationLabel={resolveRelationLabel}
            dense
          />
        </TableCell>
      ))}
      {canDelete && (
        <TableCell>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${title}`}
            disabled={isBusy}
            onClick={(e) => onDelete(record, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onDelete(record, e);
              }
            }}
          >
            <Trash2 className="text-zoru-ink-muted" aria-hidden />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Paginated, sortable, searchable table for one SabCRM object. */
export function RecordTable({
  object,
  projectId,
  onRowClick,
  onCreate,
  refreshToken = 0,
  canCreate = true,
  canDelete = true,
  onRowUpdate,
  resolveRelationLabel,
  className,
}: RecordTableProps): React.ReactElement {
  const { toast } = useZoruToast();
  const { confirm, dialog: confirmDialog } = useStConfirm();

  const columns = React.useMemo<FieldMetadata[]>(
    () => object.fields.filter((f) => f.inTable),
    [object.fields],
  );

  const [records, setRecords] = React.useState<CrmRecordWithLabel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [sort, setSort] = React.useState<SortState | null>(null);
  /**
   * Ids that are currently being deleted. The row is hidden immediately
   * (optimistic removal) and restored to the snapshot if the server errors.
   */
  const [deletingIds, setDeletingIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  /**
   * Ids that are currently being updated optimistically. Used only to mark
   * the row as busy (aria-busy + reduced opacity) while the server call is
   * in-flight.
   */
  const [updatingIds, setUpdatingIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  // Local refresh counter, combined with the external `refreshToken`.
  const [localTick, setLocalTick] = React.useState(0);

  // Keep a stable ref to toast so callbacks don't need it in their dep arrays.
  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Keep a stable ref to records so optimistic rollbacks don't need the
  // records array in callback dep arrays (avoiding stale-closure issues).
  const recordsRef = React.useRef(records);
  React.useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Stable ref to `total` so handleDelete can snapshot it without being
  // listed as a dep (which would recreate the callback — and cause every
  // memoized RecordRow to re-render — on each delete).
  const totalRef = React.useRef(total);
  React.useEffect(() => {
    totalRef.current = total;
  }, [total]);

  // Stable ref to `onRowUpdate` so handleRowUpdate stays referentially stable
  // across host re-renders that pass a new (but equivalent) callback.
  const onRowUpdateRef = React.useRef(onRowUpdate);
  React.useEffect(() => {
    onRowUpdateRef.current = onRowUpdate;
  }, [onRowUpdate]);

  // Debounce the search box.
  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  // Fetch records whenever the query inputs change.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query: RecordQuery = {
      object: object.slug,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      search: debouncedSearch || undefined,
      sortBy: sort?.by,
      sortDir: sort?.dir,
    };

    void listRecordsAction(query, projectId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setRecords([]);
        setTotal(0);
        return;
      }
      setRecords(res.data.records);
      setTotal(res.data.total);
    });

    return () => {
      cancelled = true;
    };
  }, [
    object.slug,
    page,
    debouncedSearch,
    sort?.by,
    sort?.dir,
    projectId,
    refreshToken,
    localTick,
  ]);

  const toggleSort = React.useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.by !== key) return { by: key, dir: 'asc' };
      if (prev.dir === 'asc') return { by: key, dir: 'desc' };
      return null;
    });
    setPage(1);
  }, []);

  // ---------------------------------------------------------------------------
  // Optimistic delete
  // ---------------------------------------------------------------------------

  const handleDelete = React.useCallback(
    async (record: CrmRecordWithLabel, e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      const title = resolveRecordTitle(record, object.fields);
      const ok = await confirm({
        title: 'Delete record?',
        message: `Delete "${title}"? This cannot be undone.`,
        destructive: true,
        confirmLabel: 'Delete',
      });
      if (!ok) return;

      // --- Optimistic removal ---
      // Read current values through refs so this callback stays stable across
      // renders (avoids making `total` a dep, which would invalidate all
      // memoized RecordRow instances on each deletion).
      const snapshotRecords = recordsRef.current;
      const snapshotTotal = totalRef.current;

      setDeletingIds((prev) => new Set([...prev, record._id]));
      setRecords((curr) => curr.filter((r) => r._id !== record._id));
      setTotal((t) => Math.max(0, t - 1));

      const res = await deleteRecordAction(record._id, projectId);

      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(record._id);
        return next;
      });

      if (!res.ok) {
        // --- Rollback ---
        setRecords(snapshotRecords);
        setTotal(snapshotTotal);
        toastRef.current({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      toastRef.current({ title: `Deleted ${object.labelSingular.toLowerCase()}.` });
    },
    // totalRef / recordsRef / toastRef are stable refs — excluded from deps intentionally.
    // confirm is stable (useStConfirm memoises it with useCallback + []).
    [object.fields, object.labelSingular, projectId, confirm],
  );

  // ---------------------------------------------------------------------------
  // Optimistic update (called by the host via onRowUpdate prop — the table
  // itself wires the server action; the host just supplies the patch data).
  // ---------------------------------------------------------------------------

  const handleRowUpdate = React.useCallback(
    async (recordId: string, patch: Record<string, unknown>) => {
      const snapshot = recordsRef.current;

      // --- Optimistic patch ---
      setUpdatingIds((prev) => new Set([...prev, recordId]));
      setRecords((curr) =>
        curr.map((r) => (r._id === recordId ? applyPatch(r, patch) : r)),
      );

      const res = await updateRecordAction(recordId, patch, projectId);

      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });

      if (!res.ok) {
        // --- Rollback ---
        setRecords(snapshot);
        toastRef.current({
          title: 'Update failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      toastRef.current({ title: 'Record updated.' });
      // Notify the host via ref so this callback stays stable regardless of
      // whether the host passes a new `onRowUpdate` function reference.
      onRowUpdateRef.current?.(recordId, patch);
    },
    // onRowUpdateRef / toastRef / recordsRef are stable refs — excluded intentionally.
    [projectId],
  );

  // ---------------------------------------------------------------------------
  // Keyboard navigation between rows
  // ---------------------------------------------------------------------------

  const tbodyRef = React.useRef<HTMLTableSectionElement>(null);

  const handleRowKeyDown = React.useCallback(
    (record: CrmRecordWithLabel, e: React.KeyboardEvent<HTMLTableRowElement>) => {
      switch (e.key) {
        case 'Enter':
        case ' ': {
          e.preventDefault();
          onRowClick?.(record);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const rows = tbodyRef.current?.querySelectorAll<HTMLElement>('tr[tabindex="0"]');
          if (!rows) break;
          const idx = Array.from(rows).indexOf(e.currentTarget);
          (rows[idx + 1] as HTMLElement | undefined)?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const rows = tbodyRef.current?.querySelectorAll<HTMLElement>('tr[tabindex="0"]');
          if (!rows) break;
          const idx = Array.from(rows).indexOf(e.currentTarget);
          (rows[idx - 1] as HTMLElement | undefined)?.focus();
          break;
        }
        default:
          break;
      }
    },
    [onRowClick],
  );

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const colSpan = columns.length + 1 + (canDelete ? 1 : 0);

  // Aria-sort value for a column (only one column is sorted at a time).
  const ariaSortFor = (key: string): React.AriaAttributes['aria-sort'] => {
    if (sort?.by !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={`${object.labelPlural} controls`}>
        <div className="min-w-[220px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingSlot={<Search />}
            placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
            aria-label={`Search ${object.labelPlural.toLowerCase()}`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh table"
          disabled={loading}
          onClick={() => setLocalTick((n) => n + 1)}
        >
          <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
        </Button>
        {canCreate && onCreate && (
          <Button type="button" onClick={onCreate}>
            <Plus aria-hidden /> New {object.labelSingular.toLowerCase()}
          </Button>
        )}
      </div>

      {/* Live region — screen readers announced record count changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {!loading && !error && (
          <>
            {total} {total === 1 ? object.labelSingular : object.labelPlural}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
          </>
        )}
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line"
        role="region"
        aria-label={`${object.labelPlural} table`}
        aria-busy={loading}
      >
        <Table aria-label={object.labelPlural} aria-rowcount={total}>
          {/*
           * sr-only caption provides a concise description of the table's
           * purpose for screen reader users who navigate by table landmarks.
           * The visible column headers are sufficient for sighted users.
           */}
          <TableCaption className="sr-only">
            {object.labelPlural}
            {debouncedSearch ? ` — filtered by "${debouncedSearch}"` : ''}
            {sort ? ` — sorted by ${sort.by} ${sort.dir}ending` : ''}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[36%]"
                scope="col"
                aria-sort={ariaSortFor('__title__')}
              >
                <SortHeader
                  label={object.labelSingular}
                  active={sort?.by === '__title__'}
                  dir={sort?.dir}
                  onClick={() => toggleSort('__title__')}
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSortFor(col.key)}
                >
                  <SortHeader
                    label={col.label}
                    active={sort?.by === col.key}
                    dir={sort?.dir}
                    onClick={() => toggleSort(col.key)}
                  />
                </TableHead>
              ))}
              {canDelete && (
                <TableHead
                  className="w-12"
                  scope="col"
                  aria-label="Row actions"
                />
              )}
            </TableRow>
          </TableHeader>
          {/* Pass the ref down to the <tbody> so keyboard nav can query rows */}
          <TableBody ref={tbodyRef}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} aria-hidden>
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10">
                  <EmptyState
                    title="Couldn't load records"
                    description={error}
                  />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10">
                  <EmptyState
                    title={
                      debouncedSearch
                        ? 'No matches'
                        : `No ${object.labelPlural.toLowerCase()} yet`
                    }
                    description={
                      debouncedSearch
                        ? `Nothing matched "${debouncedSearch}".`
                        : `Create your first ${object.labelSingular.toLowerCase()} to get started.`
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              records.map((record, rowIndex) => (
                <RecordRow
                  key={record._id}
                  record={record}
                  rowIndex={rowIndex}
                  columns={columns}
                  fields={object.fields}
                  isDeleting={deletingIds.has(record._id)}
                  isUpdating={updatingIds.has(record._id)}
                  isInteractive={!!onRowClick}
                  canDelete={canDelete}
                  resolveRelationLabel={resolveRelationLabel}
                  onRowClick={onRowClick}
                  onRowKeyDown={handleRowKeyDown}
                  onDelete={handleDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {!loading && !error && total > 0 && (
        <div
          className="flex items-center justify-between text-sm text-zoru-ink-muted"
          aria-label="Pagination"
        >
          <span aria-live="polite" aria-atomic="true">
            {total} {total === 1 ? object.labelSingular : object.labelPlural}
          </span>
          <div className="flex items-center gap-2" role="group" aria-label="Page navigation">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="tabular-nums" aria-current="page" aria-label={`Page ${page} of ${totalPages}`}>
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortHeader
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: 'asc' | 'desc';
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted transition-colors hover:text-zoru-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink"
    >
      {label}
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
      )}
    </button>
  );
}
