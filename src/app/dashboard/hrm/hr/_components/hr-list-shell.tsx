'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
  useZoruToast,
  ZoruCheckbox,
} from '@/components/zoruui';
import {
  Plus,
  Pencil,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill,
  statusToTone,
  type StatusTone } from '@/components/crm/status-pill';

/**
 * <HrListShell /> — shared §1D-bar list page chrome for HR & Performance
 * entities.
 *
 * Composes:
 *   <EntityListShell> + KPI strip + status filter chip row
 *   + simple bulk action bar + table.
 *
 * Each entity passes:
 *   - `kpis`        — array of { label, value, tone? } cards rendered on top.
 *   - `columns`     — table columns (key, label, render).
 *   - `rows`        — current page of rows.
 *   - `getRowId`    — extract row id (defaults to `_id`).
 *   - `statusOptions` — chip filter values; one extra "All" auto-inserted.
 *   - `getRowStatus` — read status string from a row.
 *   - `searchPredicate` — (row, q) => boolean for client-side search.
 *   - `onDelete`    — server action.
 *   - `newHref`, `editHref` — routes.
 *
 * Files kept under 600 lines (lint cap from CRM_REBUILD_PLAN.md).
 */

import * as React from 'react';
import Link from 'next/link';

export interface HrListColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  numeric?: boolean;
}

export interface HrListKpi {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatusTone;
  onClick?: () => void;
  active?: boolean;
}

export interface HrListShellProps<T> {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  newHref: string;
  editHref: (row: T) => string;
  detailHref?: (row: T) => string;
  columns: HrListColumn<T>[];
  rows: T[];
  loading: boolean;
  kpis: HrListKpi[];
  /** Status chip filter values; "All" is prepended. */
  statusOptions?: { value: string; label: string; tone?: StatusTone }[];
  getRowStatus?: (row: T) => string;
  getRowId?: (row: T) => string;
  searchPredicate?: (row: T, q: string) => boolean;
  searchPlaceholder?: string;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  emptyText?: string;
  /** Optional toolbar slot (view-switcher etc). */
  viewSwitcher?: React.ReactNode;
  /** Optional extra filter chips slot. */
  extraFilters?: React.ReactNode;
  /** Override children area; if omitted, default table is rendered. */
  children?: React.ReactNode;
  /** Optional refresh trigger after delete. */
  onAfterChange?: () => void;
}

const DEFAULT_GET_ID = (row: unknown): string =>
  String((row as { _id?: unknown } | null | undefined)?._id ?? '');

export function HrListShell<T>({
  title,
  subtitle,
  icon: Icon,
  newHref,
  editHref,
  detailHref,
  columns,
  rows,
  loading,
  kpis,
  statusOptions,
  getRowStatus,
  getRowId,
  searchPredicate,
  searchPlaceholder,
  onDelete,
  emptyText,
  viewSwitcher,
  extraFilters,
  children,
  onAfterChange,
}: HrListShellProps<T>): React.JSX.Element {
  const { toast } = useZoruToast();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const rowId = getRowId ?? DEFAULT_GET_ID;

  const filtered = React.useMemo(() => {
    let out = rows;
    if (statusFilter !== 'all' && getRowStatus) {
      const want = statusFilter.toLowerCase();
      out = out.filter((r) => String(getRowStatus(r) ?? '').toLowerCase() === want);
    }
    if (search && searchPredicate) {
      out = out.filter((r) => searchPredicate(r, search.toLowerCase()));
    }
    return out;
  }, [rows, statusFilter, search, getRowStatus, searchPredicate]);

  const toggleOne = React.useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const toggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(all ? new Set(filtered.map((r) => rowId(r))) : new Set());
    },
    [filtered, rowId],
  );

  const handleDeleteOne = React.useCallback(async () => {
    if (!deletingId) return;
    const res = await onDelete(deletingId);
    if (res.success) {
      toast({ title: 'Deleted' });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deletingId);
        return next;
      });
      onAfterChange?.();
    } else {
      toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
    }
    setDeletingId(null);
  }, [deletingId, onDelete, toast, onAfterChange]);

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const res = await onDelete(id);
      if (res.success) ok += 1;
    }
    toast({ title: `${ok} item${ok === 1 ? '' : 's'} deleted` });
    setSelected(new Set());
    setBulkDeleteOpen(false);
    onAfterChange?.();
  }, [selected, onDelete, toast, onAfterChange]);

  return (
    <>
      <EntityListShell
        title={title}
        subtitle={subtitle}
        primaryAction={
          <ZoruButton asChild>
            <Link href={newHref}>
              <Plus className="h-4 w-4" />
              New
            </Link>
          </ZoruButton>
        }
        search={
          searchPredicate
            ? {
                value: search,
                onChange: setSearch,
                placeholder: searchPlaceholder ?? 'Search…',
              }
            : undefined
        }
        viewSwitcher={viewSwitcher}
        filters={
          statusOptions || extraFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              {statusOptions ? (
                <>
                  <ZoruButton
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    All
                  </ZoruButton>
                  {statusOptions.map((opt) => (
                    <ZoruButton
                      key={opt.value}
                      variant={statusFilter === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter(opt.value)}
                    >
                      {opt.label}
                    </ZoruButton>
                  ))}
                </>
              ) : null}
              {extraFilters}
            </div>
          ) : null
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zoru-ink">
                {selected.size} selected
              </span>
              <div className="flex gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
        empty={
          !loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Icon className="h-8 w-8 text-zoru-ink-muted" aria-hidden="true" />
              <h3 className="text-base font-medium text-zoru-ink">
                {emptyText ?? 'Nothing here yet'}
              </h3>
              <ZoruButton asChild>
                <Link href={newHref}>
                  <Plus className="h-4 w-4" />
                  Add first
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {kpis.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {kpis.map((k) => (
                <ZoruCard
                  key={k.label}
                  className={`p-3 ${k.onClick ? 'cursor-pointer transition-colors hover:bg-zoru-surface-2' : ''} ${k.active ? 'ring-2 ring-zoru-ink' : ''}`}
                  onClick={k.onClick}
                  role={k.onClick ? 'button' : undefined}
                  tabIndex={k.onClick ? 0 : undefined}
                  onKeyDown={
                    k.onClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') k.onClick?.();
                        }
                      : undefined
                  }
                >
                  <p className="text-xs text-zoru-ink-muted">{k.label}</p>
                  <p className="mt-1 text-xl font-semibold text-zoru-ink">
                    {k.value}
                  </p>
                  {k.hint ? (
                    <p className="mt-0.5 text-[11px] text-zoru-ink-muted">{k.hint}</p>
                  ) : null}
                </ZoruCard>
              ))}
            </div>
          ) : null}

          {children ?? (
            <ZoruCard className="p-0">
              <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead className="w-10">
                        <ZoruCheckbox
                          aria-label="Select all"
                          checked={
                            filtered.length > 0 &&
                            selected.size === filtered.length
                          }
                          onCheckedChange={(v) => toggleAll(Boolean(v))}
                        />
                      </ZoruTableHead>
                      {columns.map((c) => (
                        <ZoruTableHead key={c.key} className={c.className}>
                          {c.label}
                        </ZoruTableHead>
                      ))}
                      <ZoruTableHead className="w-[120px] text-right">
                        Actions
                      </ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {filtered.map((row) => {
                      const id = rowId(row);
                      const href = detailHref ? detailHref(row) : editHref(row);
                      return (
                        <ZoruTableRow key={id}>
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label="Select row"
                              checked={selected.has(id)}
                              onCheckedChange={() => toggleOne(id)}
                            />
                          </ZoruTableCell>
                          {columns.map((c) => (
                            <ZoruTableCell
                              key={c.key}
                              className={
                                (c.numeric ? 'tabular-nums text-right ' : '') +
                                'text-[13px] text-zoru-ink'
                              }
                            >
                              {c.render
                                ? c.render(row)
                                : ((row as Record<string, unknown>)[c.key] as
                                    | React.ReactNode
                                    | undefined) ?? '—'}
                            </ZoruTableCell>
                          ))}
                          <ZoruTableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton variant="ghost" size="sm" asChild>
                                <Link href={href} aria-label="View / Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Link>
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                aria-label="Delete"
                                onClick={() => setDeletingId(id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </div>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            </ZoruCard>
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete this entry?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteOne}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} entries?`}
        description="This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}

/** Convenience: render a status pill from a string with sensible defaults. */
export function HrStatusCell({ value }: { value: string | undefined }) {
  if (!value) return <span className="text-zoru-ink-muted">—</span>;
  return <StatusPill label={value} tone={statusToTone(value)} />;
}

/** Date cell — formats ISO/Date to YYYY-MM-DD or em dash. */
export function HrDateCell({ value }: { value: unknown }) {
  if (!value) return <span className="text-zoru-ink-muted">—</span>;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return <span className="text-zoru-ink-muted">—</span>;
  return <span>{d.toISOString().slice(0, 10)}</span>;
}

/** Number cell with thousands separators. */
export function HrNumCell({ value, suffix }: { value: unknown; suffix?: string }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return <span className="text-zoru-ink-muted">—</span>;
  return (
    <span className="tabular-nums">
      {n.toLocaleString()}
      {suffix ? <span className="ml-0.5 text-[11px] text-zoru-ink-muted">{suffix}</span> : null}
    </span>
  );
}

/** Progress bar cell — value 0–100. */
export function HrProgressCell({ value }: { value: unknown }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-zoru-line';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zoru-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-zoru-ink-muted">{pct}%</span>
    </div>
  );
}

/** Small badge used for type/category chips. */
export function HrChip({ children }: { children: React.ReactNode }) {
  return <ZoruBadge variant="secondary">{children}</ZoruBadge>;
}
