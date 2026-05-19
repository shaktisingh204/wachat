'use client';

/**
 * <RecurringInvoiceListClient> — §1D list view for Recurring Invoices.
 *
 * Composes <EntityListShell> with:
 *  - KPI strip (Total · Active · Paused · Stopped · Completed)
 *  - Status + frequency filters via <EnumFilterField>
 *  - Dense ZoruTable with row checkboxes
 *  - Bulk-action bar (delete · export CSV)
 *  - Hard-delete confirmation dialog
 */

import * as React from 'react';
import Link from 'next/link';
import {
  useRouter,
  useSearchParams,
  usePathname,
} from 'next/navigation';
import { RefreshCw, Plus } from 'lucide-react';
import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
  deleteRecurringInvoice,
  type CrmRecurringInvoiceDoc,
  type CrmRecurringInvoiceStatus,
} from '@/app/actions/crm-recurring-invoices.actions';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface RecurringInvoiceListClientProps {
  invoices: CrmRecurringInvoiceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  error?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function frequencyLabel(f: CrmRecurringInvoiceDoc['frequency']): string {
  const map: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };
  return map[f] ?? f;
}

function toCsv(rows: CrmRecurringInvoiceDoc[]): string {
  const head = ['id', 'title', 'customerId', 'frequency', 'status', 'startDate', 'nextRunAt', 'lastRunAt', 'totalRuns', 'createdAt'];
  const body = rows.map((r) =>
    [
      r._id,
      r.title ?? '',
      r.customerId ?? '',
      r.frequency,
      r.status,
      r.startDate ?? '',
      r.nextRunAt ?? '',
      r.lastRunAt ?? '',
      r.totalRuns ?? '',
      r.createdAt ?? '',
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

const ALL = 'all';

/* ─── KPI Card ───────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: number;
  active?: boolean;
  onClick: () => void;
}

function KpiCard({ label, value, active, onClick }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col items-start rounded-[var(--zoru-radius)] border px-4 py-3 text-left transition-colors',
        active
          ? 'border-zoru-accent bg-zoru-accent/10'
          : 'border-zoru-line bg-zoru-surface hover:bg-zoru-surface-hover',
      ].join(' ')}
    >
      <span className="text-lg font-semibold tabular-nums text-zoru-ink">{value}</span>
      <span className="text-[11.5px] text-zoru-ink-muted">{label}</span>
    </button>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function RecurringInvoiceListClient({
  invoices: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  error,
}: RecurringInvoiceListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus || ALL);
  const [frequencyFilter, setFrequencyFilter] = React.useState<string>(ALL);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<CrmRecurringInvoiceDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();

  /* Push search to URL (debounced) */
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  /* Push status filter to URL */
  const applyStatusFilter = React.useCallback(
    (val: string) => {
      setStatusFilter(val);
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (val && val !== ALL) params.set('status', val);
      else params.delete('status');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [sp, pathname, router],
  );

  /* In-memory filter */
  const filtered = React.useMemo(() => {
    return serverRows.filter((inv) => {
      if (statusFilter !== ALL && inv.status !== statusFilter) return false;
      if (frequencyFilter !== ALL && inv.frequency !== frequencyFilter) return false;
      return true;
    });
  }, [serverRows, statusFilter, frequencyFilter]);

  /* Derived KPIs from full server window */
  const kpi = React.useMemo(() => {
    const counts: Record<CrmRecurringInvoiceStatus, number> = {
      active: 0,
      paused: 0,
      stopped: 0,
      completed: 0,
    };
    for (const inv of serverRows) {
      if (inv.status in counts) counts[inv.status]++;
    }
    return { total: serverRows.length, ...counts };
  }, [serverRows]);

  /* Selection helpers */
  const allIds = React.useMemo(() => filtered.map((inv) => inv._id), [filtered]);
  const allSelectedOnPage = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleRow = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      const allSel = allIds.every((id) => prev.has(id));
      if (allSel) {
        const next = new Set(prev);
        for (const id of allIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allIds) next.add(id);
      return next;
    });
  }, [allIds]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  /* Single delete */
  function confirmDelete() {
    if (!pendingDelete?._id) return;
    const id = pendingDelete._id;
    const label = pendingDelete.title || id;
    startBusy(async () => {
      const res = await deleteRecurringInvoice(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }

  /* Bulk delete */
  function bulkDelete() {
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await deleteRecurringInvoice(id);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Deleted ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'All selected removed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      router.refresh();
    });
  }

  /* CSV export */
  const bulkExport = React.useCallback(() => {
    const rows = filtered.filter((inv) => selected.size === 0 || selected.has(inv._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recurring-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} schedules saved to CSV.` });
  }, [filtered, selected, toast]);

  const filtersActive = statusFilter !== ALL || frequencyFilter !== ALL;

  return (
    <>
      <EntityListShell
        title="Recurring Invoices"
        subtitle="Templates that automatically generate invoices on a schedule."
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Search recurring invoices…',
        }}
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/recurring-invoices/new">
              <Plus className="h-4 w-4" /> New recurring
            </Link>
          </ZoruButton>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selected.size} selected</span>
              <ZoruButton size="sm" variant="outline" onClick={bulkExport}>
                Export CSV
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="ghost"
                className="text-zoru-danger-ink"
                onClick={() => setPendingBulkDelete(true)}
                disabled={busy}
              >
                Delete
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={clearSelection}>
                Clear
              </ZoruButton>
            </div>
          ) : null
        }
        empty={
          filtered.length === 0 && !filtersActive && !query ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <RefreshCw className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No recurring invoices yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Set up a recurring schedule to automatically generate invoices for repeat billing.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/sales/recurring-invoices/new">
                  <Plus className="h-4 w-4" /> New recurring
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
        pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} />}
      >
        <div className="flex flex-col gap-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiCard label="Total" value={kpi.total} active={statusFilter === ALL} onClick={() => applyStatusFilter(ALL)} />
            <KpiCard label="Active" value={kpi.active} active={statusFilter === 'active'} onClick={() => applyStatusFilter('active')} />
            <KpiCard label="Paused" value={kpi.paused} active={statusFilter === 'paused'} onClick={() => applyStatusFilter('paused')} />
            <KpiCard label="Stopped" value={kpi.stopped} active={statusFilter === 'stopped'} onClick={() => applyStatusFilter('stopped')} />
            <KpiCard label="Completed" value={kpi.completed} active={statusFilter === 'completed'} onClick={() => applyStatusFilter('completed')} />
          </div>

          {error ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
              {error}
            </div>
          ) : null}

          <ZoruCard className="overflow-hidden p-0">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zoru-line px-3 py-2">
              <div className="w-44">
                <EnumFilterField
                  enumName="invoiceStatus"
                  value={statusFilter}
                  onChange={applyStatusFilter}
                  allLabel="All statuses"
                  placeholder="Status"
                />
              </div>
              <div className="w-44">
                <EnumFilterField
                  enumName="recurringFrequency"
                  value={frequencyFilter}
                  onChange={setFrequencyFilter}
                  allLabel="All frequencies"
                  placeholder="Frequency"
                />
              </div>
              {filtersActive ? (
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFrequencyFilter(ALL);
                    applyStatusFilter(ALL);
                  }}
                  className="text-[12px] text-zoru-ink-muted"
                >
                  Clear filters
                </ZoruButton>
              ) : null}
            </div>

            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-[36px]">
                    <ZoruCheckbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Title / template</ZoruTableHead>
                  <ZoruTableHead>Customer</ZoruTableHead>
                  <ZoruTableHead>Frequency</ZoruTableHead>
                  <ZoruTableHead>Next run</ZoruTableHead>
                  <ZoruTableHead>Last run</ZoruTableHead>
                  <ZoruTableHead>Runs</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {filtersActive || query
                        ? 'No recurring invoices match these filters.'
                        : 'No recurring invoices yet — click "New recurring" to add one.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((inv) => {
                    const id = inv._id;
                    const isSelected = selected.has(id);
                    return (
                      <ZoruTableRow key={id} data-state={isSelected ? 'selected' : undefined}>
                        <ZoruTableCell>
                          <ZoruCheckbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={`Select ${inv.title || id}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/sales/recurring-invoices/${id}`}
                            label={inv.title || `Schedule ${id.slice(-6)}`}
                            subtitle={frequencyLabel(inv.frequency)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px]">
                          {inv.customerId ? (
                            <EntityPickerChip entity="client" id={inv.customerId} />
                          ) : (
                            <span className="text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {frequencyLabel(inv.frequency)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(inv.nextRunAt)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(inv.lastRunAt)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink-muted">
                          {typeof inv.totalRuns === 'number' ? inv.totalRuns : '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={inv.status}
                            tone={statusToTone(inv.status)}
                          />
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                )}
              </ZoruTableBody>
            </ZoruTable>
          </ZoruCard>
        </div>
      </EntityListShell>

      {/* Single delete */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete recurring invoice?"
        description={
          pendingDelete
            ? `This permanently removes "${pendingDelete.title || pendingDelete._id}" from the database. This action cannot be undone.`
            : 'This permanently removes the recurring invoice schedule. This action cannot be undone.'
        }
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => confirmDelete()}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={setPendingBulkDelete}
        title={`Delete ${selected.size} recurring invoice${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected recurring invoice schedules. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => bulkDelete()}
      />

      {busy ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
