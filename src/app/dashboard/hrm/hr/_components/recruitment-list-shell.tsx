'use client';
import { fmtDate } from '@/lib/utils';

import {
  Button,
  Card,
  ZoruCardContent,
  Checkbox,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Input,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Plus,
  Download,
  Trash2,
  Archive,
  Search } from 'lucide-react';

/**
 * RecruitmentListShell — §1D.1 list-page scaffolding shared by the
 * 7 HR recruitment pillars (Job → Candidate → Interview → Offer →
 * Onboarding → Probation → Employee).
 *
 * Renders:
 *   • KPI strip (4-5 stat cards, each filterable)
 *   • Search input
 *   • Filter chips row (status, owner, date range, plus per-entity custom)
 *   • Bulk action bar (archive / delete / export)
 *   • Table OR custom view (kanban/calendar) via render-prop
 *   • Pagination
 *
 * Per-entity callers pass column defs, filter configs, KPI definitions,
 * an action that returns the rows + KPI counts, and an optional view
 * switcher (e.g. table | kanban for candidates, table | calendar for
 * interviews).
 *
 * Composes the shared `<EntityListShell>` shell so all CRM/HRM list
 * pages share toolbar / sticky bulk bar / pagination / empty-state.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface RecruitmentKpi {
  key: string;
  label: string;
  /** rendered value (can be a number, formatted string, etc.) */
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** when defined, clicking the card toggles a filter (key passed back) */
  filterValue?: string;
}

export interface RecruitmentColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface RecruitmentFilterOption {
  value: string;
  label: string;
}

export interface RecruitmentFilter {
  /** Form-state key — matches the parent's filter dict. */
  key: string;
  label: string;
  /** type: 'select' renders ZoruSelect; type: 'date' renders ZoruInput[type=date] */
  type: 'select' | 'date' | 'text';
  options?: RecruitmentFilterOption[];
  placeholder?: string;
}

export interface RecruitmentListShellProps<T extends { _id: string }> {
  title: string;
  subtitle: string;
  basePath: string;
  /** Items label (e.g. "candidates"). Used for empty state copy + counts. */
  singular: string;
  /** Items list to render. */
  rows: T[];
  /** Loading state. */
  loading?: boolean;
  /** KPI cards (4 or 5). */
  kpis: RecruitmentKpi[];
  /** Currently-active KPI filter (toggled via card clicks). */
  activeKpi?: string;
  onPickKpi?: (key: string | undefined) => void;
  /** Search value + setter. */
  search: string;
  onSearchChange: (next: string) => void;
  /** Filter defs (status, owner, date range, etc.) — 5+ recommended. */
  filters: RecruitmentFilter[];
  /** Current filter values (dict keyed by filter.key). */
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  /** Columns (8-10 recommended per §1D.1). */
  columns: RecruitmentColumn<T>[];
  /** Optional view switcher (table / kanban / calendar). */
  views?: { key: string; label: string; icon?: React.ReactNode }[];
  activeView?: string;
  onPickView?: (key: string) => void;
  /** When `activeView !== 'table'`, render this instead of the table. */
  customView?: React.ReactNode;
  /** Bulk delete action. */
  onBulkDelete?: (ids: string[]) => Promise<unknown>;
  /** Bulk archive action (optional). */
  onBulkArchive?: (ids: string[]) => Promise<unknown>;
  /** Row delete action. */
  onDelete?: (id: string) => Promise<unknown>;
  /** Pagination. */
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  /** Row link template — defaults to `${basePath}/${id}`. */
  rowHref?: (row: T) => string;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function RecruitmentListShell<T extends { _id: string }>({
  title,
  subtitle,
  basePath,
  singular,
  rows,
  loading,
  kpis,
  activeKpi,
  onPickKpi,
  search,
  onSearchChange,
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
  columns,
  views,
  activeView,
  onPickView,
  customView,
  onBulkDelete,
  onBulkArchive,
  onDelete,
  page = 1,
  limit = 20,
  total,
  onPageChange,
  rowHref,
}: RecruitmentListShellProps<T>): React.JSX.Element {
  const { toast } = useZoruToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = (on: boolean) =>
    setSelected(on ? new Set(rows.map((r) => String(r._id))) : new Set());

  const exportCsv = React.useCallback(() => {
    const ids =
      selected.size > 0
        ? rows.filter((r) => selected.has(String(r._id)))
        : rows;
    const header = columns.map((c) => c.label).join(',');
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = ids
      .map((row) =>
        columns
          .map((c) => {
            const v = (row as any)[c.key];
            if (v == null) return '""';
            if (v instanceof Date) return escape(v.toISOString());
            return escape(v);
          })
          .join(','),
      )
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${singular.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, rows, selected, singular]);

  const handleConfirmDelete = async () => {
    if (!deletingId || !onDelete) return;
    const res: any = await onDelete(deletingId);
    if (res?.success !== false && !res?.error) {
      toast({ title: 'Deleted', description: `${singular} removed.` });
    } else {
      toast({
        title: 'Delete failed',
        description: res?.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
    setDeletingId(null);
  };

  const handleConfirmBulkDelete = async () => {
    if (!onBulkDelete || selected.size === 0) return;
    const ids = Array.from(selected);
    const res: any = await onBulkDelete(ids);
    if (res?.success !== false && !res?.error) {
      toast({ title: `${ids.length} ${singular.toLowerCase()}(s) deleted.` });
      setSelected(new Set());
    } else {
      toast({
        title: 'Bulk delete failed',
        description: res?.error || 'Failed',
        variant: 'destructive',
      });
    }
    setBulkDeleteOpen(false);
  };

  const totalCount = total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const hasActiveFilters =
    Object.values(filterValues).some(Boolean) ||
    Boolean(activeKpi) ||
    Boolean(search);

  /* ── KPI strip ───────────────────────────────────────────────────── */
  const kpiStrip = (
    <div
      className={`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-${Math.min(kpis.length, 5)}`}
    >
      {kpis.map((k) => (
        <button
          key={k.key}
          type="button"
          onClick={() => {
            if (!k.filterValue || !onPickKpi) return;
            onPickKpi(activeKpi === k.filterValue ? undefined : k.filterValue);
          }}
          className={[
            'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
            activeKpi === k.filterValue
              ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]'
              : '',
          ].join(' ')}
        >
          <StatCard label={k.label} value={k.value} icon={k.icon} />
        </button>
      ))}
    </div>
  );

  /* ── View switcher ───────────────────────────────────────────────── */
  const viewSwitcher = views && views.length > 1 ? (
    <div
      role="tablist"
      className="inline-flex rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-0.5"
    >
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={activeView === v.key}
          onClick={() => onPickView?.(v.key)}
          className={[
            'inline-flex items-center gap-1 rounded-[calc(var(--st-radius)-2px)] px-2.5 py-1 text-[12px]',
            activeView === v.key
              ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow-[var(--zoru-shadow-xs)]'
              : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
          ].join(' ')}
        >
          {v.icon}
          {v.label}
        </button>
      ))}
    </div>
  ) : null;

  /* ── Filter row ──────────────────────────────────────────────────── */
  const filterRow = (
    <>
      {filters.map((f) => {
        if (f.type === 'select') {
          return (
            <Select
              key={f.key}
              value={filterValues[f.key] || '__all'}
              onValueChange={(v) =>
                onFilterChange(f.key, v === '__all' ? '' : v)
              }
            >
              <ZoruSelectTrigger className="h-8 w-auto min-w-[140px] text-[12px]">
                <ZoruSelectValue placeholder={f.placeholder || f.label} />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="__all">All {f.label}</ZoruSelectItem>
                {(f.options || []).map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          );
        }
        if (f.type === 'date') {
          return (
            <Input
              key={f.key}
              type="date"
              value={filterValues[f.key] || ''}
              onChange={(e) => onFilterChange(f.key, e.target.value)}
              className="h-8 w-[148px] text-[12px]"
              placeholder={f.label}
            />
          );
        }
        return (
          <Input
            key={f.key}
            value={filterValues[f.key] || ''}
            onChange={(e) => onFilterChange(f.key, e.target.value)}
            className="h-8 w-[148px] text-[12px]"
            placeholder={f.placeholder || f.label}
            leadingSlot={<Search aria-hidden="true" />}
          />
        );
      })}
      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-[12px]"
        >
          Clear all
        </Button>
      ) : null}
    </>
  );

  /* ── Bulk bar ────────────────────────────────────────────────────── */
  const bulkBar = selected.size > 0 ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] text-[var(--st-text)]">
        {selected.size} selected
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        {onBulkArchive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBulkArchive(Array.from(selected))}
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button>
        ) : null}
        {onBulkDelete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            className="text-[var(--st-danger)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(new Set())}
        >
          Clear
        </Button>
      </div>
    </div>
  ) : null;

  /* ── Body ─────────────────────────────────────────────────────────── */
  const isTableView = !activeView || activeView === 'table' || !customView;

  const tableBody = (
    <Card className="p-0">
      <ZoruCardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-10">
                  <Checkbox
                    checked={
                      rows.length > 0 && selected.size === rows.length
                    }
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                {columns.map((c) => (
                  <ZoruTableHead key={c.key} className={c.className}>
                    {c.label}
                  </ZoruTableHead>
                ))}
                <ZoruTableHead className="w-[80px] text-right">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={columns.length + 2}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No {singular.toLowerCase()} matches the current filters.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => {
                  const id = String(row._id);
                  const href = rowHref ? rowHref(row) : `${basePath}/${id}`;
                  return (
                    <ZoruTableRow key={id}>
                      <ZoruTableCell className="w-10">
                        <Checkbox
                          checked={selected.has(id)}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select ${id}`}
                        />
                      </ZoruTableCell>
                      {columns.map((c) => (
                        <ZoruTableCell
                          key={c.key}
                          className="text-[13px] text-[var(--st-text)]"
                        >
                          {c.render
                            ? c.render(row)
                            : asNode((row as any)[c.key])}
                        </ZoruTableCell>
                      ))}
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={href}
                              aria-label={`Open ${singular.toLowerCase()}`}
                            >
                              View
                            </Link>
                          </Button>
                          {onDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Delete"
                              onClick={() => setDeletingId(id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                            </Button>
                          ) : null}
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </Table>
        </div>
      </ZoruCardContent>
    </Card>
  );

  return (
    <>
      <EntityListShell
        title={title}
        subtitle={subtitle}
        viewSwitcher={viewSwitcher}
        search={{
          value: search,
          onChange: onSearchChange,
          placeholder: `Search ${singular.toLowerCase()}…`,
        }}
        primaryAction={
          <Button asChild>
            <Link href={`${basePath}/new`}>
              <Plus className="h-4 w-4" /> New {singular}
            </Link>
          </Button>
        }
        filters={filterRow}
        bulkBar={bulkBar}
        loading={loading && rows.length === 0}
        pagination={
          rows.length > 0 && onPageChange ? (
            <PaginationBar
              page={page}
              limit={limit}
              hasMore={page < totalPages}
              total={totalCount}
              controlled={{ onChange: (n) => onPageChange(n.page) }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {kpiStrip}
          {isTableView ? tableBody : customView}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title={`Delete this ${singular.toLowerCase()}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} ${singular.toLowerCase()}(s)?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmBulkDelete}
      />
    </>
  );
}

function asNode(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return fmtDate(value);
  if (Array.isArray(value)) return String(value.length);
  return String(value);
}

/* ─── Helper: render a status cell using statusToTone ────────────── */
export function renderStatusCell(value?: string): React.ReactNode {
  if (!value) return '—';
  return <StatusPill label={value} tone={statusToTone(value)} />;
}
