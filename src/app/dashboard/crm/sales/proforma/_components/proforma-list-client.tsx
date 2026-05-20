'use client';

/**
 * <ProformaListClient> — §1D list view for Proforma Invoices.
 *
 * Composes <EntityListShell> with:
 *  - KPI strip (Total · Issued · Converted · Expired · Pending)
 *  - Status filter via <EnumFilterField enumName="quotationStatus" />
 *  - Client/account filter chip
 *  - Dense ZoruTable with row checkboxes
 *  - Bulk-action bar (archive · delete · export CSV)
 *  - Hard-delete + archive confirmation dialogs
 */

import * as React from 'react';
import Link from 'next/link';
import {
  useRouter,
  useSearchParams,
  usePathname,
} from 'next/navigation';
import {
  CalendarRange,
  Download,
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react';
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
  archiveProformaInvoice,
  deleteProformaInvoice,
  type ProformaKpis,
} from '@/app/actions/crm-proforma-invoices.actions';
import { dateStamp, downloadXlsx } from '@/lib/crm-list-export';
import type { CrmProformaInvoiceDoc } from '@/lib/rust-client/crm-proforma-invoices';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface ProformaListClientProps {
  invoices: CrmProformaInvoiceDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  kpi: ProformaKpis;
  error?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function toCsv(rows: CrmProformaInvoiceDoc[]): string {
  const head = ['id', 'proformaNumber', 'accountId', 'proformaDate', 'status', 'currency', 'total', 'createdAt'];
  const body = rows.map((r) =>
    [
      r._id,
      r.proformaNumber,
      r.accountId ?? '',
      r.proformaDate,
      r.status ?? '',
      r.currency ?? '',
      r.total,
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

/* ─── KPI Strip ──────────────────────────────────────────────────────── */

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

export function ProformaListClient({
  invoices: serverRows,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  initialDateFrom = '',
  initialDateTo = '',
  kpi,
  error,
}: ProformaListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus || ALL);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<CrmProformaInvoiceDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();

  function pushParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  /* Push search to URL (debounced) */
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      pushParams({ q: query.trim() || undefined, page: '1' });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, initialQuery]);

  /* Push status filter to URL */
  const applyStatusFilter = React.useCallback(
    (val: string) => {
      setStatusFilter(val);
      pushParams({ status: val && val !== ALL ? val : undefined, page: '1' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp, pathname, router],
  );

  /* In-memory filter on top of server rows */
  const filtered = React.useMemo(() => {
    return serverRows.filter((inv) => {
      if (statusFilter !== ALL && inv.status !== statusFilter) return false;
      if (initialDateFrom) {
        const d = inv.proformaDate ? new Date(inv.proformaDate).toISOString().slice(0, 10) : '';
        if (!d || d < initialDateFrom) return false;
      }
      if (initialDateTo) {
        const d = inv.proformaDate ? new Date(inv.proformaDate).toISOString().slice(0, 10) : '';
        if (!d || d > initialDateTo) return false;
      }
      return true;
    });
  }, [serverRows, statusFilter, initialDateFrom, initialDateTo]);

  /* Selection helpers */
  const allIds = React.useMemo(() => filtered.map((inv) => String(inv._id)), [filtered]);
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
    const id = String(pendingDelete._id);
    const label = pendingDelete.proformaNumber || id;
    startBusy(async () => {
      const res = await deleteProformaInvoice(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }

  /* Bulk archive */
  const bulkArchive = React.useCallback(() => {
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await archiveProformaInvoice(id);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Archived ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'Selected proformas archived.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      router.refresh();
    });
  }, [selected, toast, clearSelection, router]);

  /* Bulk delete */
  function bulkDelete() {
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await deleteProformaInvoice(id);
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
    const rows = filtered.filter((inv) => selected.size === 0 || selected.has(String(inv._id)));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proforma-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} proforma invoices saved to CSV.` });
  }, [filtered, selected, toast]);

  /* XLSX export */
  const bulkExportXlsx = React.useCallback(() => {
    const rows = filtered.filter((inv) => selected.size === 0 || selected.has(String(inv._id)));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const headers = ['id', 'proformaNumber', 'accountId', 'proformaDate', 'validTillDate', 'status', 'currency', 'total', 'createdAt'];
    const exportRows = rows.map((r) => ({
      id: String(r._id),
      proformaNumber: r.proformaNumber ?? '',
      accountId: r.accountId ?? '',
      proformaDate: r.proformaDate ?? '',
      validTillDate: r.validTillDate ?? '',
      status: r.status ?? '',
      currency: r.currency ?? '',
      total: r.total ?? '',
      createdAt: r.createdAt ?? '',
    }));
    void downloadXlsx(`proforma-invoices-${dateStamp()}.xlsx`, headers, exportRows, 'Proformas');
    toast({ title: 'Exported', description: `${rows.length} proforma invoices saved to XLSX.` });
  }, [filtered, selected, toast]);

  const filtersActive = statusFilter !== ALL || Boolean(initialDateFrom) || Boolean(initialDateTo);

  return (
    <>
      <EntityListShell
        title="Proforma Invoices"
        subtitle="Draft, issue, and convert proforma invoices before billing."
        search={{
          value: query,
          onChange: setQuery,
          placeholder: 'Search proformas…',
        }}
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/proforma/new">
              <Plus className="h-4 w-4" /> New proforma
            </Link>
          </ZoruButton>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selected.size} selected</span>
              <ZoruButton size="sm" variant="outline" onClick={bulkArchive} disabled={busy}>
                Archive
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" onClick={bulkExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" onClick={bulkExportXlsx}>
                <Download className="h-3.5 w-3.5" /> Export XLSX
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
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            </div>
          ) : null
        }
        empty={
          filtered.length === 0 && !filtersActive && !query ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No proforma invoices yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Create a proforma invoice to share a cost estimate before issuing a formal invoice.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/sales/proforma/new">
                  <Plus className="h-4 w-4" /> New proforma
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
            <KpiCard label="Total" value={kpi.total} onClick={() => applyStatusFilter(ALL)} active={statusFilter === ALL} />
            <KpiCard label="Issued" value={kpi.issued} onClick={() => applyStatusFilter('Issued')} active={statusFilter === 'Issued'} />
            <KpiCard label="Converted" value={kpi.converted} onClick={() => applyStatusFilter('Converted')} active={statusFilter === 'Converted'} />
            <KpiCard label="Expired" value={kpi.expired} onClick={() => applyStatusFilter('Expired')} active={statusFilter === 'Expired'} />
            <KpiCard label="Pending" value={kpi.pending} onClick={() => applyStatusFilter('Draft')} active={statusFilter === 'Draft'} />
          </div>

          {error ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
              {error}
            </div>
          ) : null}

          <ZoruCard className="overflow-hidden p-0">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zoru-line px-3 py-2">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search proformas…"
                  className="h-9 w-full rounded-md border border-zoru-line bg-transparent pl-9 pr-3 text-[13px] text-zoru-ink placeholder:text-zoru-ink-muted focus:outline-none focus:ring-1 focus:ring-zoru-accent"
                />
              </div>
              <div className="w-44">
                <EnumFilterField
                  enumName="quotationStatus"
                  value={statusFilter}
                  onChange={applyStatusFilter}
                  allLabel="All statuses"
                  placeholder="Status"
                />
              </div>
              <details className="relative">
                <summary className="list-none">
                  <ZoruButton variant="outline" size="sm" className="h-9 text-[12.5px]">
                    <CalendarRange className="h-3.5 w-3.5" /> Date range
                  </ZoruButton>
                </summary>
                <div className="absolute left-0 z-20 mt-2 grid w-[260px] gap-2 rounded-md border border-zoru-line bg-zoru-surface p-3 shadow-md">
                  <label className="text-[11px] text-zoru-ink-muted">From</label>
                  <input
                    type="date"
                    defaultValue={initialDateFrom}
                    onChange={(e) => pushParams({ dateFrom: e.target.value || undefined, page: '1' })}
                    className="h-8 w-full rounded-md border border-zoru-line bg-transparent px-2 text-[12.5px] text-zoru-ink focus:outline-none focus:ring-1 focus:ring-zoru-accent"
                  />
                  <label className="text-[11px] text-zoru-ink-muted">To</label>
                  <input
                    type="date"
                    defaultValue={initialDateTo}
                    onChange={(e) => pushParams({ dateTo: e.target.value || undefined, page: '1' })}
                    className="h-8 w-full rounded-md border border-zoru-line bg-transparent px-2 text-[12.5px] text-zoru-ink focus:outline-none focus:ring-1 focus:ring-zoru-accent"
                  />
                </div>
              </details>
              {filtersActive ? (
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    applyStatusFilter(ALL);
                    pushParams({ dateFrom: undefined, dateTo: undefined, page: '1' });
                  }}
                  className="text-[12px] text-zoru-ink-muted"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
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
                  <ZoruTableHead>Proforma #</ZoruTableHead>
                  <ZoruTableHead>Customer</ZoruTableHead>
                  <ZoruTableHead>Date</ZoruTableHead>
                  <ZoruTableHead>Valid until</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={7}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {filtersActive || query
                        ? 'No proforma invoices match these filters.'
                        : 'No proforma invoices yet — click "New proforma" to add one.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((inv) => {
                    const id = String(inv._id);
                    const isSelected = selected.has(id);
                    return (
                      <ZoruTableRow key={id} data-state={isSelected ? 'selected' : undefined}>
                        <ZoruTableCell>
                          <ZoruCheckbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={`Select ${inv.proformaNumber}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/sales/proforma/${id}`}
                            label={inv.proformaNumber}
                            subtitle={fmtDate(inv.proformaDate)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {inv.accountId ? (
                            <EntityPickerChip entity="client" id={inv.accountId} />
                          ) : (
                            <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(inv.proformaDate)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(inv.validTillDate)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {inv.status ? (
                            <StatusPill
                              label={inv.status}
                              tone={statusToTone(inv.status.toLowerCase())}
                            />
                          ) : (
                            <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                          {fmtMoney(inv.total, inv.currency)}
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
        title="Delete proforma invoice?"
        description={
          pendingDelete
            ? `This permanently removes ${pendingDelete.proformaNumber} from the database. This action cannot be undone.`
            : 'This permanently removes the proforma invoice. This action cannot be undone.'
        }
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => confirmDelete()}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulkDelete}
        onOpenChange={setPendingBulkDelete}
        title={`Delete ${selected.size} proforma invoice${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected proforma invoices. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => bulkDelete()}
      />

      {busy ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
