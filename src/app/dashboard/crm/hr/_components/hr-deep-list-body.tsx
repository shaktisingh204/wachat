'use client';

/**
 * <HrDeepListBody /> — §1D Deep-list page body for HR performance +
 * learning entities (OKRs, 360 feedback, 1:1s, recognition, surveys).
 *
 * Renders inside <HrListShell />'s `children` slot, replacing the default
 * lightweight table. Adds the full "Deep list" toolkit:
 *
 *   - extended filter row (search · status · cycle · dept · owner · date range)
 *   - bulk action bar (archive / delete / export-CSV / export-XLSX
 *     · plus an optional "Send reminder" action when supplied)
 *   - selectable rows with EntityRowLink primary column
 *   - ConfirmDialog for archive + bulk delete
 *   - PaginationBar (client-side, since list actions return arrays)
 *
 * Each list page passes:
 *   - `rows`              — already filtered+sorted entity rows
 *   - `columns`           — list-shell column defs
 *   - `getRowId`          — usually `(r) => r._id`
 *   - `detailHref`        — first column wraps in <EntityRowLink>
 *   - `editHref`          — pencil action target
 *   - exporter
 *       · `exportColumns` — header → row-value extractor map (CSV/XLSX)
 *       · `exportName`    — base filename (no extension)
 *   - actions
 *       · `onDeleteOne`     — single delete (re-used from action module)
 *       · `onBulkDelete`    — `(ids) => Promise<{ success; deleted }>`
 *       · `onBulkArchive`   — `(ids) => Promise<{ success; archived }>`
 *       · `onBulkReminder?` — optional reminder action
 *   - filter slots
 *       · `cycleOptions?`, `cycle`, `setCycle`
 *       · `deptOptions?`,  `dept`,  `setDept`
 *       · `ownerOptions?`, `owner`, `setOwner`
 *       · `dateField?`     — name of the row field for date-range filtering
 *       · `dateFrom`, `dateTo`, `setDateFrom`, `setDateTo`
 *       · `search`, `setSearch`
 *
 * No new external deps — everything composes ZoruUI + EntityListShell's
 * downstream primitives.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Archive,
  Download,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

/* ─── Public types ────────────────────────────────────────────────────── */

export interface DeepColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  numeric?: boolean;
}

export interface DeepExportColumn<T> {
  /** Spreadsheet header. */
  header: string;
  /** Row → exported cell value (stringy primitives). */
  value: (row: T) => string | number | null | undefined;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface BulkResult {
  success: boolean;
  /** Optional count surface for the toast. */
  deleted?: number;
  archived?: number;
  notified?: number;
  error?: string;
}

export interface HrDeepListBodyProps<T> {
  rows: T[];
  columns: DeepColumn<T>[];
  getRowId: (row: T) => string;
  detailHref: (row: T) => string;
  editHref: (row: T) => string;

  /* selection + bulk */
  onDeleteOne: (id: string) => Promise<{ success: boolean; error?: string }>;
  onBulkDelete: (ids: string[]) => Promise<BulkResult>;
  onBulkArchive: (ids: string[]) => Promise<BulkResult>;
  onBulkReminder?: (ids: string[]) => Promise<BulkResult>;
  reminderLabel?: string;
  onAfterChange?: () => void;

  /* search + filters (controlled by parent) */
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder?: string;

  cycleOptions?: SelectOption[];
  cycle?: string;
  setCycle?: (v: string) => void;
  cycleLabel?: string;

  deptOptions?: SelectOption[];
  dept?: string;
  setDept?: (v: string) => void;

  ownerOptions?: SelectOption[];
  owner?: string;
  setOwner?: (v: string) => void;

  dateFrom?: string;
  dateTo?: string;
  setDateFrom?: (v: string) => void;
  setDateTo?: (v: string) => void;

  /* export */
  exportColumns: DeepExportColumn<T>[];
  exportName: string;

  /* table chrome */
  emptyText?: string;
  /** Optional preface row (e.g. KPIs are already rendered above). */
  beforeTable?: React.ReactNode;
}

const PAGE_SIZES = [10, 20, 50, 100];

/* ─── Component ───────────────────────────────────────────────────────── */

export function HrDeepListBody<T>(props: HrDeepListBodyProps<T>): React.JSX.Element {
  const {
    rows,
    columns,
    getRowId,
    detailHref,
    editHref,
    onDeleteOne,
    onBulkDelete,
    onBulkArchive,
    onBulkReminder,
    reminderLabel = 'Send reminder',
    onAfterChange,
    search,
    setSearch,
    searchPlaceholder,
    cycleOptions,
    cycle,
    setCycle,
    cycleLabel,
    deptOptions,
    dept,
    setDept,
    ownerOptions,
    owner,
    setOwner,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    exportColumns,
    exportName,
    emptyText,
    beforeTable,
  } = props;

  const { toast } = useZoruToast();

  /* selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  /* pagination */
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  /* dialogs */
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  /* reset to page 1 when filters change */
  React.useEffect(() => {
    setPage(1);
  }, [search, cycle, dept, owner, dateFrom, dateTo, limit]);

  const totalRows = rows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / limit));
  const safePage = Math.min(page, pageCount);
  const pageRows = React.useMemo(
    () => rows.slice((safePage - 1) * limit, safePage * limit),
    [rows, safePage, limit],
  );

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(getRowId(r)));

  const togglePage = React.useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of pageRows) {
          const id = getRowId(r);
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [pageRows, getRowId],
  );

  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  /* ── bulk handlers ──────────────────────────────────────────────────── */

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await onBulkDelete(ids);
      if (res.success) {
        toast({
          title: `Deleted ${res.deleted ?? ids.length} item${
            (res.deleted ?? ids.length) === 1 ? '' : 's'
          }`,
        });
        clearSelection();
        onAfterChange?.();
      } else {
        toast({
          title: 'Bulk delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
      setBulkDeleteOpen(false);
    }
  }, [selected, onBulkDelete, toast, clearSelection, onAfterChange]);

  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await onBulkArchive(ids);
      if (res.success) {
        toast({
          title: `Archived ${res.archived ?? ids.length} item${
            (res.archived ?? ids.length) === 1 ? '' : 's'
          }`,
        });
        clearSelection();
        onAfterChange?.();
      } else {
        toast({
          title: 'Bulk archive failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
      setBulkArchiveOpen(false);
    }
  }, [selected, onBulkArchive, toast, clearSelection, onAfterChange]);

  const handleBulkReminder = React.useCallback(async () => {
    if (!onBulkReminder) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await onBulkReminder(ids);
      if (res.success) {
        toast({
          title: `Reminder queued for ${res.notified ?? ids.length} item${
            (res.notified ?? ids.length) === 1 ? '' : 's'
          }`,
        });
      } else {
        toast({
          title: 'Reminder failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setBusy(false);
    }
  }, [selected, onBulkReminder, toast]);

  const handleDeleteOne = React.useCallback(async () => {
    if (!pendingDeleteId) return;
    const res = await onDeleteOne(pendingDeleteId);
    if (res.success) {
      toast({ title: 'Deleted' });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(pendingDeleteId);
        return next;
      });
      onAfterChange?.();
    } else {
      toast({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
    }
    setPendingDeleteId(null);
  }, [pendingDeleteId, onDeleteOne, toast, onAfterChange]);

  /* ── export ─────────────────────────────────────────────────────────── */

  const exportRowsFrom = React.useCallback(
    (source: T[]): ExportRow[] =>
      source.map((row) => {
        const out: ExportRow = {};
        for (const col of exportColumns) {
          out[col.header] = col.value(row) ?? '';
        }
        return out;
      }),
    [exportColumns],
  );

  const handleExportCsv = React.useCallback(() => {
    const ids = Array.from(selected);
    const source = ids.length > 0 ? rows.filter((r) => ids.includes(getRowId(r))) : rows;
    if (source.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `${exportName}-${dateStamp()}.csv`,
      exportColumns.map((c) => c.header),
      exportRowsFrom(source),
    );
  }, [selected, rows, getRowId, exportColumns, exportRowsFrom, exportName, toast]);

  const handleExportXlsx = React.useCallback(() => {
    const ids = Array.from(selected);
    const source = ids.length > 0 ? rows.filter((r) => ids.includes(getRowId(r))) : rows;
    if (source.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    void downloadXlsx(
      `${exportName}-${dateStamp()}.xlsx`,
      exportColumns.map((c) => c.header),
      exportRowsFrom(source),
      exportName,
    );
  }, [selected, rows, getRowId, exportColumns, exportRowsFrom, exportName, toast]);

  /* ── derived render ─────────────────────────────────────────────────── */

  const hasMore = safePage * limit < totalRows;
  const showEmpty = totalRows === 0;
  const showFilterRow =
    Boolean(cycleOptions) ||
    Boolean(deptOptions) ||
    Boolean(ownerOptions) ||
    Boolean(setDateFrom);

  return (
    <div className="flex flex-col gap-3">
      {beforeTable}

      {/* search + filter row (parent shell already renders status chips above) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search…'}
          />
        </div>

        {showFilterRow ? (
          <>
            {cycleOptions && setCycle ? (
              <Select value={cycle ?? 'all'} onValueChange={setCycle}>
                <ZoruSelectTrigger className="h-9 w-[160px]">
                  <ZoruSelectValue placeholder={cycleLabel ?? 'Cycle'} />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">
                    All {cycleLabel?.toLowerCase() ?? 'cycles'}
                  </ZoruSelectItem>
                  {cycleOptions.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            ) : null}

            {deptOptions && setDept ? (
              <Select value={dept ?? 'all'} onValueChange={setDept}>
                <ZoruSelectTrigger className="h-9 w-[160px]">
                  <ZoruSelectValue placeholder="Department" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                  {deptOptions.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            ) : null}

            {ownerOptions && setOwner ? (
              <Select value={owner ?? 'all'} onValueChange={setOwner}>
                <ZoruSelectTrigger className="h-9 w-[160px]">
                  <ZoruSelectValue placeholder="Owner" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All owners</ZoruSelectItem>
                  {ownerOptions.map((o) => (
                    <ZoruSelectItem key={o.value} value={o.value}>
                      {o.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            ) : null}

            {setDateFrom && setDateTo ? (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  className="h-9 w-[150px]"
                  value={dateFrom ?? ''}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="From date"
                />
                <span className="text-[12px] text-zoru-ink-muted">to</span>
                <Input
                  type="date"
                  className="h-9 w-[150px]"
                  value={dateTo ?? ''}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="To date"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            aria-label="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportXlsx}
            aria-label="Export XLSX"
          >
            <Download className="h-3.5 w-3.5" />
            XLSX
          </Button>
        </div>
      </div>

      {/* bulk action bar (sticky when selection > 0) */}
      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <span className="text-sm text-zoru-ink">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelection} disabled={busy}>
              Clear
            </Button>
            {onBulkReminder ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void handleBulkReminder();
                }}
                disabled={busy}
              >
                <Send className="h-3.5 w-3.5" />
                {reminderLabel}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={busy}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportXlsx}
              disabled={busy}
            >
              <Download className="h-3.5 w-3.5" />
              Export XLSX
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkArchiveOpen(true)}
              disabled={busy}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      {/* table */}
      <Card className="p-0">
        <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-10">
                  <Checkbox
                    aria-label="Select page"
                    checked={allOnPageSelected}
                    onCheckedChange={(v) => togglePage(Boolean(v))}
                  />
                </ZoruTableHead>
                {columns.map((c) => (
                  <ZoruTableHead key={c.key} className={c.className}>
                    {c.label}
                  </ZoruTableHead>
                ))}
                <ZoruTableHead className="w-[120px] text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {showEmpty ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={columns.length + 2}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    {emptyText ?? 'No records match these filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                pageRows.map((row) => {
                  const id = getRowId(row);
                  return (
                    <ZoruTableRow key={id}>
                      <ZoruTableCell>
                        <Checkbox
                          aria-label="Select row"
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleOne(id)}
                        />
                      </ZoruTableCell>
                      {columns.map((c, colIdx) => {
                        const raw = c.render
                          ? c.render(row)
                          : ((row as Record<string, unknown>)[c.key] as
                              | React.ReactNode
                              | undefined) ?? '—';
                        const content =
                          colIdx === 0 ? (
                            <EntityRowLink href={detailHref(row)} label={raw} />
                          ) : (
                            raw
                          );
                        return (
                          <ZoruTableCell
                            key={c.key}
                            className={
                              (c.numeric ? 'tabular-nums text-right ' : '') +
                              'text-[13px] text-zoru-ink'
                            }
                          >
                            {content}
                          </ZoruTableCell>
                        );
                      })}
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={editHref(row)} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete"
                            onClick={() => setPendingDeleteId(id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                          </Button>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </Table>
        </div>

        {totalRows > 0 ? (
          <PaginationBar
            page={safePage}
            limit={limit}
            hasMore={hasMore}
            total={totalRows}
            pageSizes={PAGE_SIZES}
            controlled={{
              onChange: (next) => {
                if (next.limit !== limit) {
                  setLimit(next.limit);
                  setPage(1);
                } else {
                  setPage(next.page);
                }
              },
            }}
          />
        ) : null}
      </Card>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="Delete this entry?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteOne}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        description="Archived records stay in the database but are hidden from active views."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={handleBulkArchive}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected records."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
