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
  EmptyState,
  Skeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  listRecordsAction,
  deleteRecordAction,
} from '@/app/actions/sabcrm.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecordWithLabel,
  RecordQuery,
} from '@/lib/sabcrm/types';
import { FieldValue, resolveRecordTitle } from './field-renderer';

const DEFAULT_PAGE_SIZE = 25;

export interface RecordTableProps {
  object: ObjectMetadata;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Invoked when a row is clicked (e.g. to open the detail panel). */
  onRowClick?: (record: CrmRecordWithLabel) => void;
  /** Invoked when the "New" button is pressed. */
  onCreate?: () => void;
  /** When the caller mutates a record elsewhere, bump this to refetch. */
  refreshToken?: number;
  /** Whether the current user may create records (gates the New button). */
  canCreate?: boolean;
  /** Whether the current user may delete records (gates row delete). */
  canDelete?: boolean;
  /** Resolver mapping a related record id to a label, for RELATION cells. */
  resolveRelationLabel?: (id: string) => string | undefined;
  className?: string;
}

interface SortState {
  by: string;
  dir: 'asc' | 'desc';
}

/** Paginated, sortable, searchable table for one SabCRM object. */
export function RecordTable({
  object,
  projectId,
  onRowClick,
  onCreate,
  refreshToken = 0,
  canCreate = true,
  canDelete = true,
  resolveRelationLabel,
  className,
}: RecordTableProps): React.ReactElement {
  const { toast } = useZoruToast();

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
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  // Local refresh counter, combined with the external `refreshToken`.
  const [localTick, setLocalTick] = React.useState(0);

  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

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

  const onDelete = React.useCallback(
    async (record: CrmRecordWithLabel, e: React.MouseEvent) => {
      e.stopPropagation();
      const title = resolveRecordTitle(record, object.fields);
      const confirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(`Delete “${title}”? This cannot be undone.`);
      if (!confirmed) return;

      setDeletingId(record._id);
      const res = await deleteRecordAction(record._id, projectId);
      setDeletingId(null);

      if (!res.ok) {
        toastRef.current({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toastRef.current({ title: `Deleted ${object.labelSingular.toLowerCase()}.` });
      setRecords((curr) => curr.filter((r) => r._id !== record._id));
      setTotal((t) => Math.max(0, t - 1));
    },
    [object.fields, object.labelSingular, projectId],
  );

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const colSpan = columns.length + 1 + (canDelete ? 1 : 0);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingSlot={<Search />}
            placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh"
          disabled={loading}
          onClick={() => setLocalTick((n) => n + 1)}
        >
          <RefreshCw className={cn(loading && 'animate-spin')} />
        </Button>
        {canCreate && onCreate && (
          <Button type="button" onClick={onCreate}>
            <Plus /> New {object.labelSingular.toLowerCase()}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36%]">
                <SortHeader
                  label={object.labelSingular}
                  active={sort?.by === '__title__'}
                  dir={sort?.dir}
                  onClick={() => toggleSort('__title__')}
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  <SortHeader
                    label={col.label}
                    active={sort?.by === col.key}
                    dir={sort?.dir}
                    onClick={() => toggleSort(col.key)}
                  />
                </TableHead>
              ))}
              {canDelete && <TableHead className="w-12" aria-label="Actions" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
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
                    title="Couldn’t load records"
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
                        ? `Nothing matched “${debouncedSearch}”.`
                        : `Create your first ${object.labelSingular.toLowerCase()} to get started.`
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow
                  key={record._id}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    deletingId === record._id && 'opacity-50',
                  )}
                  onClick={() => onRowClick?.(record)}
                >
                  <TableCell className="font-medium text-zoru-ink">
                    {resolveRecordTitle(record, object.fields)}
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
                        aria-label={`Delete ${object.labelSingular.toLowerCase()}`}
                        disabled={deletingId === record._id}
                        onClick={(e) => void onDelete(record, e)}
                      >
                        <Trash2 className="text-zoru-ink-muted" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between text-sm text-zoru-ink-muted">
          <span>
            {total} {total === 1 ? object.labelSingular : object.labelPlural}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted transition-colors hover:text-zoru-ink"
    >
      {label}
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}
