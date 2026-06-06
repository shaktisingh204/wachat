'use client';

/**
 * <ProformaListClient> — §1D list view for Proforma Invoices.
 * Upgraded to use spreadsheet-style CrmBulkyGrid and useCrmBulkyState.
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
import { Button, Card, useToast, Input } from '@/components/sabcrm/20ui';

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
  patchProformaInvoice,
  listProformaInvoices,
  type ProformaKpis,
} from '@/app/actions/crm-proforma-invoices.actions';
import { dateStamp, downloadXlsx } from '@/lib/crm-list-export';
import type { CrmProformaInvoiceDoc, CrmProformaStatus } from '@/lib/rust-client/crm-proforma-invoices';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

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
        'flex flex-col items-start rounded-[var(--st-radius)] border px-4 py-3 text-left transition-colors',
        active
          ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/10'
          : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:bg-[var(--st-hover)]',
      ].join(' ')}
    >
      <span className="text-lg font-semibold tabular-nums text-[var(--st-text)]">{value}</span>
      <span className="text-[11.5px] text-[var(--st-text-secondary)]">{label}</span>
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
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus || ALL);
  const [pendingDelete, setPendingDelete] = React.useState<CrmProformaInvoiceDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [density, setDensity] = React.useState<'comfortable' | 'compact' | 'dense'>('comfortable');

  const pushParams = React.useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, pathname, router]);

  /* Bulky State Hook */
  const bulky = useCrmBulkyState<CrmProformaInvoiceDoc>({
    initialData: serverRows,
    initialPage: page,
    initialLimit: limit,
    fetchFn: async ({ page: p, limit: l, search, filters: f }) => {
      const res = await listProformaInvoices({
        page: p,
        limit: l,
        q: search || undefined,
        status: statusFilter !== ALL ? (statusFilter as CrmProformaStatus) : undefined,
      });
      return res;
    },
  });

  // Re-sync local grid when server inputs change
  React.useEffect(() => {
    bulky.setData(serverRows);
  }, [serverRows]);

  React.useEffect(() => {
    bulky.triggerFetch();
  }, [bulky.page, bulky.limit, statusFilter]);

  /* Push search to URL (debounced) */
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      pushParams({ q: query.trim() || undefined, page: '1' });
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, pushParams]);

  /* Push status filter to URL */
  const applyStatusFilter = React.useCallback(
    (val: string) => {
      setStatusFilter(val);
      pushParams({ status: val && val !== ALL ? val : undefined, page: '1' });
    },
    [pushParams],
  );

  /* Single delete */
  function confirmDelete() {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.proformaNumber || id;
    bulky.runBulkOperation(async () => {
      const res = await deleteProformaInvoice(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
      return res;
    });
  }

  /* Bulk archive */
  const bulkArchive = React.useCallback(() => {
    bulky.runBulkOperation(async (ids) => {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        const res = await archiveProformaInvoice(id);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Archived ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'Selected proformas archived.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      router.refresh();
      return { success: fail === 0 };
    });
  }, [bulky, toast, router]);

  /* Bulk delete */
  function bulkDelete() {
    bulky.runBulkOperation(async (ids) => {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        const res = await deleteProformaInvoice(id);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Deleted ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'All selected removed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      setPendingBulkDelete(false);
      router.refresh();
      return { success: fail === 0 };
    });
  }

  /* CSV export */
  const bulkExport = React.useCallback(() => {
    const rows = bulky.data.filter((inv) => bulky.selected.size === 0 || bulky.selected.has(String(inv._id)));
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
  }, [bulky.data, bulky.selected, toast]);

  /* XLSX export */
  const bulkExportXlsx = React.useCallback(() => {
    const rows = bulky.data.filter((inv) => bulky.selected.size === 0 || bulky.selected.has(String(inv._id)));
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
  }, [bulky.data, bulky.selected, toast]);

  /* Inline Save handler */
  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmProformaInvoiceDoc>) => {
    try {
      const res = await patchProformaInvoice(id, updatedFields);
      if (res.success) {
        toast({ title: 'Saved inline', description: 'Proforma invoice updated successfully.' });
        bulky.cancelInlineEdit();
        bulky.triggerFetch();
        router.refresh();
      } else {
        toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const filtersActive = statusFilter !== ALL || Boolean(initialDateFrom) || Boolean(initialDateTo);

  const columns = React.useMemo<ColumnDef<CrmProformaInvoiceDoc>[]>(() => [
    {
      key: 'proformaNumber',
      header: 'Proforma #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales/proforma/${row._id}`}
          label={row.proformaNumber || '—'}
          subtitle={fmtDate(row.proformaDate)}
        />
      ),
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-36 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'accountId',
      header: 'Customer',
      render: (row) => row.accountId ? (
        <EntityPickerChip entity="client" id={row.accountId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'proformaDate',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{fmtDate(row.proformaDate)}</span>,
      editRender: (row, value, onChange) => (
        <Input
          type="date"
          size="sm"
          className="h-8 w-36 text-[12.5px]"
          value={value !== undefined ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'validTillDate',
      header: 'Valid until',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{fmtDate(row.validTillDate)}</span>,
      editRender: (row, value, onChange) => (
        <Input
          type="date"
          size="sm"
          className="h-8 w-36 text-[12.5px]"
          value={value !== undefined ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-[var(--st-text-secondary)]">{row.currency || 'INR'}</span>,
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-20 text-[12.5px]"
          value={value !== undefined ? String(value) : 'INR'}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'total',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text)] font-semibold">
          {fmtMoney(row.total, row.currency)}
        </span>
      ),
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          className="h-8 w-28 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => row.status ? (
        <StatusPill
          label={row.status}
          tone={statusToTone(row.status.toLowerCase())}
        />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options = ['Draft', 'Issued', 'Converted', 'Expired', 'Cancelled'];
        return (
          <select
            className="h-8 w-28 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] text-[12.5px] p-1 outline-none"
            value={value !== undefined ? String(value) : 'Draft'}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      },
    },
  ], []);

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
          <Button asChild>
            <Link href="/dashboard/crm/sales/proforma/new">
              <Plus className="h-4 w-4" /> New proforma
            </Link>
          </Button>
        }
        bulkBar={
          bulky.selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-[var(--st-text)]">{bulky.selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={bulkArchive} disabled={bulky.isPending}>
                Archive
              </Button>
              <Button size="sm" variant="outline" onClick={bulkExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={bulkExportXlsx}>
                <Download className="h-3.5 w-3.5" /> Export XLSX
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[var(--st-danger)]"
                onClick={() => setPendingBulkDelete(true)}
                disabled={bulky.isPending}
              >
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={bulky.clearSelection}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          ) : null
        }
        empty={
          bulky.data.length === 0 && !filtersActive && !query ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">No proforma invoices yet</h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                Create a proforma invoice to share a cost estimate before issuing a formal invoice.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/proforma/new">
                  <Plus className="h-4 w-4" /> New proforma
                </Link>
              </Button>
            </div>
          ) : null
        }
        pagination={<PaginationBar page={bulky.page} limit={bulky.limit} hasMore={hasMore} />}
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
            <div className="rounded border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-3 py-2 text-[12.5px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-lg">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search proformas…"
                  className="h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent pl-9 pr-3 text-[13px] text-[var(--st-text)] placeholder:text-[var(--st-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--st-accent)]"
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
                  <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                    <CalendarRange className="h-3.5 w-3.5" /> Date range
                  </Button>
                </summary>
                <div className="absolute left-0 z-20 mt-2 grid w-[260px] gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 shadow-md">
                  <label className="text-[11px] text-[var(--st-text-secondary)]">From</label>
                  <input
                    type="date"
                    defaultValue={initialDateFrom}
                    onChange={(e) => pushParams({ dateFrom: e.target.value || undefined, page: '1' })}
                    className="h-8 w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 text-[12.5px] text-[var(--st-text)] focus:outline-none focus:ring-1 focus:ring-[var(--st-accent)]"
                  />
                  <label className="text-[11px] text-[var(--st-text-secondary)]">To</label>
                  <input
                    type="date"
                    defaultValue={initialDateTo}
                    onChange={(e) => pushParams({ dateTo: e.target.value || undefined, page: '1' })}
                    className="h-8 w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 text-[12.5px] text-[var(--st-text)] focus:outline-none focus:ring-1 focus:ring-[var(--st-accent)]"
                  />
                </div>
              </details>
              {/* Density toggle buttons */}
              <div className="flex items-center border border-[var(--st-border)] rounded-md p-0.5 ml-auto bg-[var(--st-bg-muted)]/40">
                <Button
                  size="sm"
                  variant={density === 'comfortable' ? 'outline' : 'ghost'}
                  onClick={() => setDensity('comfortable')}
                  className="h-7 text-[11px] px-2"
                >
                  Comfortable
                </Button>
                <Button
                  size="sm"
                  variant={density === 'compact' ? 'outline' : 'ghost'}
                  onClick={() => setDensity('compact')}
                  className="h-7 text-[11px] px-2"
                >
                  Compact
                </Button>
                <Button
                  size="sm"
                  variant={density === 'dense' ? 'outline' : 'ghost'}
                  onClick={() => setDensity('dense')}
                  className="h-7 text-[11px] px-2"
                >
                  Dense
                </Button>
              </div>
              {filtersActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    applyStatusFilter(ALL);
                    pushParams({ dateFrom: undefined, dateTo: undefined, page: '1' });
                  }}
                  className="text-[12px] text-[var(--st-text-secondary)]"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              ) : null}
            </div>

            <CrmBulkyGrid<CrmProformaInvoiceDoc>
              columns={columns}
              data={bulky.data}
              selectedIds={bulky.selected}
              onSelectOne={bulky.toggleSelectOne}
              onSelectAll={(checked) => bulky.toggleSelectAll(bulky.data.map(x => String(x._id)), checked)}
              density={density}
              inlineEditRowId={bulky.inlineEditRowId}
              editBuffer={bulky.editBuffer}
              onStartInlineEdit={bulky.startInlineEdit}
              onCancelInlineEdit={bulky.cancelInlineEdit}
              onSaveInlineEdit={handleSaveInlineEdit}
              onUpdateEditBuffer={bulky.updateEditBuffer}
              isLoading={bulky.isPending}
            />
          </div>
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
        title={`Delete ${bulky.selected.size} proforma invoice${bulky.selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected proforma invoices. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={async () => bulkDelete()}
      />
    </>
  );
}
