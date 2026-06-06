'use client';

import { Button, Card, useToast, Input } from '@/components/sabcrm/20ui';
import { Plus, Receipt } from 'lucide-react';

/**
 * <InvoiceListClient> — upgraded canonical Invoices list view.
 *
 * Consolidates spreadsheet-style high-density editing, bulk actions,
 * KPI bars, and dynamic Radix selectors for status / agent.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { SavedViewsBar } from '@/components/crm/SavedViewsBar';
import type { SavedView } from '@/lib/saved-views/types';

import { InvoicesKpiStrip } from './invoices-kpi-strip';
import { InvoicesToolbar } from './invoices-toolbar';
import { InvoicesFilters } from './invoices-filters';
import { InvoicesCalendar } from './invoices-calendar';
import { useInvoicesBulk } from './use-invoices-bulk';
import type {
  InvoiceDensity,
  InvoiceKpiSnapshot,
  InvoiceListRow,
  InvoicePresetKey,
  InvoiceViewMode,
} from './types';

// Bulky components
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import { patchInvoice, listInvoices } from '@/app/actions/crm/invoices.actions';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

interface InvoiceListClientProps {
  invoices: InvoiceListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: InvoiceKpiSnapshot;
  defaultCurrency: string;
  currentUserId?: string | null;
  error?: string;
}

const DENSITY_KEY = 'crm.invoices.density';

function toCsv(rows: InvoiceListRow[]): string {
  const head = [
    'invoiceNo',
    'customer',
    'invoiceDate',
    'dueDate',
    'currency',
    'total',
    'paid',
    'balance',
    'status',
    'createdAt',
  ];
  const body = rows.map((r) =>
    [
      r.invoiceNo,
      r.clientLabel ?? r.clientId ?? '',
      r.date ?? '',
      r.dueDate ?? '',
      r.currency ?? '',
      r.total ?? '',
      r.paid ?? '',
      r.balance ?? '',
      r.status ?? '',
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

function isOverdue(row: InvoiceListRow): boolean {
  if (!row.dueDate) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'paid' || s === 'cancelled') return false;
  const t = new Date(row.dueDate).getTime();
  return !Number.isNaN(t) && t < Date.now() && (row.balance ?? 0) > 0;
}

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function relativeDays(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
}

export function InvoiceListClient({
  invoices: serverInvoices,
  page,
  limit,
  hasMore: initialHasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  currentUserId,
  error,
}: InvoiceListClientProps) {
  const { toast } = useToast();

  /* View + density */
  const [view, setView] = React.useState<InvoiceViewMode>('table');
  const [density, setDensity] = React.useState<InvoiceDensity>('comfortable');

  /* Hydrate density from localStorage. */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DENSITY_KEY);
      if (raw === 'comfortable' || raw === 'compact' || raw === 'dense') {
        setDensity(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const handleDensityChange = React.useCallback((next: InvoiceDensity) => {
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  /* Confirm dialogs */
  const [deletePending, setDeletePending] = React.useState(false);
  const [archivePending, setArchivePending] = React.useState(false);
  const [markPaidPending, setMarkPaidPending] = React.useState(false);
  const [sendPending, setSendPending] = React.useState(false);

  /* Bulky State Hook */
  const {
    data: invoices,
    total,
    page: gridPage,
    setPage: setGridPage,
    limit: gridLimit,
    filters,
    isPending,
    selected,
    inlineEditRowId,
    editBuffer,
    hasActiveFilters,
    handleSearch,
    updateFilter,
    clearFilters: clearGridFilters,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    startInlineEdit,
    cancelInlineEdit,
    updateEditBuffer,
    triggerFetch,
    setData: setGridData,
  } = useCrmBulkyState<InvoiceListRow>({
    initialData: serverInvoices,
    initialPage: page,
    initialLimit: limit,
    fetchFn: async ({ page: p, limit: l, search, filters: f }) => {
      const response = await listInvoices({
        page: p,
        limit: l,
        q: search || undefined,
      });

      // Map doc to InvoiceListRow
      const mappedItems = response.invoices.map((doc) => {
        const clientId = doc.clientId ? String(doc.clientId) : null;
        return {
          _id: String(doc._id),
          invoiceNo: doc.invoiceNo,
          clientId,
          clientLabel: clientId ? (serverInvoices.find(x => x.clientId === clientId)?.clientLabel || doc.clientId) : undefined,
          salesAgentId: doc.assignment?.assignedTo ? String(doc.assignment.assignedTo) : null,
          branchId: null,
          date: doc.date ?? null,
          dueDate: doc.dueDate ?? null,
          currency: doc.currency ?? 'INR',
          total: doc.totals?.total ?? 0,
          paid: doc.amountPaid ?? 0,
          balance: doc.balance ?? doc.totals?.total ?? 0,
          status: doc.status,
          createdAt: doc.createdAt ?? doc.audit?.createdAt,
          updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
        };
      });

      let items = mappedItems;

      // Apply filters client-side
      if (f.statusFilter && f.statusFilter !== 'all') {
        if (f.statusFilter === 'overdue') {
          items = items.filter(isOverdue);
        } else {
          items = items.filter((inv) => (inv.status ?? '').toLowerCase() === f.statusFilter);
        }
      }
      if (f.customerFilter) {
        items = items.filter((inv) => inv.clientId === f.customerFilter);
      }
      if (f.agentFilter) {
        items = items.filter((inv) => inv.salesAgentId === f.agentFilter);
      }
      if (f.branchFilter) {
        items = items.filter((inv) => inv.branchId === f.branchFilter);
      }
      if (f.currencyFilter) {
        items = items.filter((inv) => inv.currency === f.currencyFilter);
      }
      if (f.amountMin) {
        items = items.filter((inv) => (inv.total ?? 0) >= Number(f.amountMin));
      }
      if (f.amountMax) {
        items = items.filter((inv) => (inv.total ?? 0) <= Number(f.amountMax));
      }
      if (f.fromDate) {
        const fromTs = new Date(f.fromDate).getTime();
        items = items.filter((inv) => inv.date && new Date(inv.date).getTime() >= fromTs);
      }
      if (f.toDate) {
        const toTs = new Date(f.toDate).getTime();
        items = items.filter((inv) => inv.date && new Date(inv.date).getTime() <= toTs);
      }
      if (f.dueFrom) {
        const dueFromTs = new Date(f.dueFrom).getTime();
        items = items.filter((inv) => inv.dueDate && new Date(inv.dueDate).getTime() >= dueFromTs);
      }
      if (f.dueTo) {
        const dueToTs = new Date(f.dueTo).getTime();
        items = items.filter((inv) => inv.dueDate && new Date(inv.dueDate).getTime() <= dueToTs);
      }

      return {
        items,
        total: response.invoices.length,
        hasMore: response.hasMore,
      };
    },
  });

  // Re-sync local grid data when server component inputs change
  React.useEffect(() => {
    setGridData(serverInvoices);
  }, [serverInvoices, setGridData]);

  // Refetch when the actual query inputs change. `triggerFetch` itself is an
  // unstable callback (it closes over a fresh inline `fetchFn` every render),
  // so including it here would re-fire this effect on every render → infinite
  // refetch loop. Depend on the real inputs only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    triggerFetch();
  }, [gridPage, gridLimit, filters]);

  /* ─── Inline Edit Save ─────────────────────────────────────────────────── */
  const handleSaveInlineEdit = async (id: string, updatedData: Partial<InvoiceListRow>) => {
    const original = invoices.find((l) => l._id === id);
    if (!original) return;

    try {
      const patch: any = {};
      if (updatedData.dueDate !== undefined) patch.dueDate = updatedData.dueDate;
      if (updatedData.currency !== undefined) patch.currency = updatedData.currency;
      if (updatedData.status !== undefined) patch.status = updatedData.status;
      if (updatedData.salesAgentId !== undefined) {
        patch.assignment = { assignedTo: updatedData.salesAgentId };
      }

      const res = await patchInvoice(id, patch);
      if (res.error) {
        toast({
          title: 'Inline Edit Failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Invoice saved inline' });
        cancelInlineEdit();
        triggerFetch();
      }
    } catch (err: any) {
      toast({
        title: 'Error saving inline',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const exportCsv = React.useCallback(() => {
    const rows = invoices.filter(
      (d) => selected.size === 0 || selected.has(d._id),
    );
    if (rows.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Filter or select rows first.',
      });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} invoices saved to CSV.`,
    });
  }, [invoices, selected, toast]);

  const clearFilters = React.useCallback(() => {
    clearGridFilters();
  }, [clearGridFilters]);

  /* Presets */
  const applyPreset = React.useCallback(
    (key: InvoicePresetKey) => {
      updateFilter('preset', key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'my-overdue') {
        updateFilter('statusFilter', 'overdue');
        updateFilter('agentFilter', currentUserId ?? null);
        return;
      }
      if (key === 'due-this-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        updateFilter('statusFilter', 'all');
        updateFilter('dueFrom', fmt(today));
        updateFilter('dueTo', fmt(next7));
        return;
      }
      if (key === 'paid-30d') {
        const prev30 = new Date(today.getTime() - 30 * 86_400_000);
        updateFilter('statusFilter', 'paid');
        updateFilter('fromDate', fmt(prev30));
        updateFilter('toDate', fmt(today));
        return;
      }
      if (key === 'draft') {
        updateFilter('statusFilter', 'draft');
      }
    },
    [clearFilters, currentUserId, updateFilter],
  );

  /* Bulk handlers */
  const bulk = useInvoicesBulk({
    selected,
    onCleared: () => clearSelection(),
  });

  const filtersActive = hasActiveFilters;

  const savedViewFilters = React.useMemo(
    () => ({
      query: filters.query || '',
      statusFilter: filters.statusFilter || 'all',
      customerFilter: filters.customerFilter || null,
      agentFilter: filters.agentFilter || null,
      branchFilter: filters.branchFilter || null,
      currencyFilter: filters.currencyFilter || null,
      fromDate: filters.fromDate || '',
      toDate: filters.toDate || '',
      dueFrom: filters.dueFrom || '',
      dueTo: filters.dueTo || '',
      amountMin: filters.amountMin || '',
      amountMax: filters.amountMax || '',
      preset: filters.preset || 'all',
    }),
    [filters],
  );

  const handleApplyView = React.useCallback((view: SavedView) => {
    const f = (view.filters ?? {}) as Record<string, unknown>;
    Object.entries(f).forEach(([key, val]) => {
      updateFilter(key, val);
    });
  }, [updateFilter]);

  /* ─── Column Definitions ───────────────────────────────────────────────── */
  const columns = React.useMemo<ColumnDef<InvoiceListRow>[]>(() => [
    {
      key: 'invoiceNo',
      header: 'Invoice #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales/invoices/${row._id}`}
          label={row.invoiceNo || '—'}
          subtitle={row.clientLabel || undefined}
        />
      ),
    },
    {
      key: 'clientId',
      header: 'Customer',
      render: (row) => row.clientId ? (
        <EntityPickerChip entity="client" id={row.clientId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">{row.clientLabel ?? '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Invoice Date',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{fmtDate(row.date)}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (row) => {
        const overdue = isOverdue(row);
        const overdueClass = overdue ? 'text-[var(--st-danger)] font-semibold' : 'text-[var(--st-text-secondary)]';
        return (
          <span className={overdueClass} title={relativeDays(row.dueDate)}>
            {fmtDate(row.dueDate)}
            {overdue && <span className="ml-1 text-[10px] uppercase font-bold text-[var(--st-danger)]">overdue</span>}
          </span>
        );
      },
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
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text)] font-semibold">
          {fmtMoney(row.total, row.currency ?? 'INR')}
        </span>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text-secondary)]">
          {fmtMoney(row.paid, row.currency ?? 'INR')}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortable: true,
      render: (row) => {
        const overdue = isOverdue(row);
        return (
          <span className={`font-mono tabular-nums ${overdue && row.balance > 0 ? 'text-[var(--st-danger)] font-bold' : 'text-[var(--st-text)]'}`}>
            {fmtMoney(row.balance, row.currency ?? 'INR')}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => row.status ? (
        <StatusPill
          label={String(row.status).replace(/_/g, ' ')}
          tone={statusToTone(row.status)}
        />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options = ['draft', 'sent', 'paid', 'cancelled', 'overdue'];
        return (
          <select
            className="h-8 w-28 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] text-[12.5px] p-1 outline-none"
            value={value !== undefined ? String(value) : 'draft'}
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
    {
      key: 'salesAgentId',
      header: 'Sales Agent',
      render: (row) => row.salesAgentId ? (
        <EntityPickerChip entity="user" id={row.salesAgentId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{fmtDate(row.createdAt)}</span>,
    },
  ], [serverInvoices]);

  return (
    <>
      <EntityListShell
        title="Invoices"
        subtitle="Bill customers and track payment state across your sales pipeline."
        viewSwitcher={null}
        primaryAction={
          <Button asChild>
            <Link href="/dashboard/crm/sales/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        }
        bulkBar={
          selected.size > 0 ? (
            <InvoicesBulkBar
              count={selected.size}
              onClear={() => clearSelection()}
              onExportCsv={exportCsv}
              onArchive={() => setArchivePending(true)}
              onDelete={() => setDeletePending(true)}
              onMarkPaid={() => setMarkPaidPending(true)}
              onSend={() => setSendPending(true)}
              onChangeStatus={bulk.changeStatus}
            />
          ) : null
        }
        empty={
          invoices.length === 0 && !filtersActive ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Receipt className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">
                No invoices yet
              </h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                Bill your first customer to start tracking sales revenue.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/sales/invoices/new">
                  <Plus className="h-4 w-4" /> New invoice
                </Link>
              </Button>
            </div>
          ) : null
        }
        pagination={
          view === 'table' ? (
            <PaginationBar page={gridPage} limit={gridLimit} hasMore={initialHasMore} />
          ) : null
        }
      >
        <div className="flex flex-col gap-5">
          <SavedViewsBar
            entityKind="invoice"
            currentFilters={savedViewFilters}
            currentColumns={[]}
            onApplyView={handleApplyView}
          />

          {/* KPI strip */}
          <InvoicesKpiStrip
            kpi={kpi}
            currency={defaultCurrency}
            active={filters.preset || 'all'}
            onSelect={applyPreset}
          />

          {error ? (
            <div className="rounded border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-3 py-2 text-[12.5px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
              {error}
            </div>
          ) : null}

          <Card className="overflow-hidden p-0 border-none bg-transparent">
            <InvoicesToolbar
              query={filters.query || ''}
              onQueryChange={handleSearch}
              view={view}
              onViewChange={setView}
              density={density}
              onDensityChange={handleDensityChange}
              preset={filters.preset || 'all'}
              onPresetChange={applyPreset}
              onExportCsv={exportCsv}
            />

            <InvoicesFilters
              filtersActive={filtersActive}
              onClearAll={clearFilters}
              statusFilter={filters.statusFilter || 'all'}
              onStatusFilter={(val) => updateFilter('statusFilter', val)}
              customerFilter={filters.customerFilter || null}
              onCustomerFilter={(val) => updateFilter('customerFilter', val)}
              agentFilter={filters.agentFilter || null}
              onAgentFilter={(val) => updateFilter('agentFilter', val)}
              branchFilter={filters.branchFilter || null}
              onBranchFilter={(val) => updateFilter('branchFilter', val)}
              currencyFilter={filters.currencyFilter || null}
              onCurrencyFilter={(val) => updateFilter('currencyFilter', val)}
              fromDate={filters.fromDate || ''}
              onFromDate={(val) => updateFilter('fromDate', val)}
              toDate={filters.toDate || ''}
              onToDate={(val) => updateFilter('toDate', val)}
              dueFrom={filters.dueFrom || ''}
              onDueFrom={(val) => updateFilter('dueFrom', val)}
              dueTo={filters.dueTo || ''}
              onDueTo={(val) => updateFilter('dueTo', val)}
              amountMin={filters.amountMin || ''}
              onAmountMin={(val) => updateFilter('amountMin', val)}
              amountMax={filters.amountMax || ''}
              onAmountMax={(val) => updateFilter('amountMax', val)}
            />

            {view === 'calendar' ? (
              <div className="p-3">
                <InvoicesCalendar invoices={invoices} />
              </div>
            ) : (
              <CrmBulkyGrid<InvoiceListRow>
                columns={columns}
                data={invoices}
                selectedIds={selected}
                onSelectOne={toggleSelectOne}
                onSelectAll={(checked) => toggleSelectAll(invoices.map(x => x._id), checked)}
                density={density}
                inlineEditRowId={inlineEditRowId}
                editBuffer={editBuffer}
                onStartInlineEdit={startInlineEdit}
                onCancelInlineEdit={cancelInlineEdit}
                onSaveInlineEdit={handleSaveInlineEdit}
                onUpdateEditBuffer={updateEditBuffer}
                isLoading={isPending}
              />
            )}
          </Card>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} invoice${selected.size === 1 ? '' : 's'}?`}
        description="Archived invoices are marked cancelled and hidden from default views."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} invoice${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected invoices. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      <ConfirmDialog
        open={markPaidPending}
        onOpenChange={setMarkPaidPending}
        title={`Mark ${selected.size} invoice${selected.size === 1 ? '' : 's'} paid?`}
        description="Updates the status to paid. Use Record payment if you need to capture amounts and methods."
        confirmLabel="Mark paid"
        confirmTone="primary"
        onConfirm={async () => bulk.markPaid()}
      />

      <ConfirmDialog
        open={sendPending}
        onOpenChange={setSendPending}
        title={`Send ${selected.size} invoice${selected.size === 1 ? '' : 's'}?`}
        description="Marks these invoices as sent. Email delivery is handled by your messaging settings."
        confirmLabel="Send"
        confirmTone="primary"
        onConfirm={async () => bulk.send()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
