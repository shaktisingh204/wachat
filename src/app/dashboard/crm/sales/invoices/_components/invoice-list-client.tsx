'use client';

import { ZoruButton, ZoruCard, useZoruToast } from '@/components/zoruui';
import { Plus, Receipt } from 'lucide-react';

/**
 * <InvoiceListClient> — canonical Invoices list view per CRM_REBUILD_PLAN §1D.
 *
 * Ships:
 *   - KPI strip (outstanding, overdue, paid this month, drafts, avg days)
 *   - View switcher (table | calendar)
 *   - Filters (status, customer, sales agent, invoice date range, due
 *     date range, currency, amount range, branch)
 *   - Saved filter presets ("All", "My overdue", "Due this week", "Paid
 *     last 30 days", "Drafts")
 *   - Density toggle (Comfortable / Compact / Dense)
 *   - Search across invoice no, customer name, customer email
 *   - Bulk-action bar (archive / delete / export CSV / mark paid /
 *     send / change status)
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
import { InvoicesBulkBar } from './invoices-bulk-bar';
import { InvoicesTable } from './invoices-table';
import { InvoicesCalendar } from './invoices-calendar';
import { InvoicesFilters } from './invoices-filters';
import { useInvoicesBulk } from './use-invoices-bulk';
import type {
  InvoiceDensity,
  InvoiceKpiSnapshot,
  InvoiceListRow,
  InvoicePresetKey,
  InvoiceViewMode,
} from './types';

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

export function InvoiceListClient({
  invoices: serverInvoices,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  currentUserId,
  error,
}: InvoiceListClientProps) {
  const { toast } = useZoruToast();

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

  /* Filters */
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [customerFilter, setCustomerFilter] = React.useState<string | null>(null);
  const [agentFilter, setAgentFilter] = React.useState<string | null>(null);
  const [branchFilter, setBranchFilter] = React.useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = React.useState<string | null>(null);
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [dueFrom, setDueFrom] = React.useState('');
  const [dueTo, setDueTo] = React.useState('');
  const [amountMin, setAmountMin] = React.useState('');
  const [amountMax, setAmountMax] = React.useState('');
  const [preset, setPreset] = React.useState<InvoicePresetKey>('all');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleRow = React.useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  /* Confirm dialogs */
  const [deletePending, setDeletePending] = React.useState(false);
  const [archivePending, setArchivePending] = React.useState(false);
  const [markPaidPending, setMarkPaidPending] = React.useState(false);
  const [sendPending, setSendPending] = React.useState(false);

  /* Filtered view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY;
    const max = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY;
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    const dueFromTs = dueFrom ? new Date(dueFrom).getTime() : null;
    const dueToTs = dueTo ? new Date(dueTo).getTime() : null;

    return serverInvoices.filter((inv) => {
      if (q) {
        const hay = `${inv.invoiceNo ?? ''} ${inv.clientLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const s = (inv.status ?? '').toLowerCase();
      if (statusFilter === 'overdue') {
        if (!isOverdue(inv)) return false;
      } else if (statusFilter !== 'all' && s !== statusFilter) {
        return false;
      }
      if (customerFilter && inv.clientId !== customerFilter) return false;
      if (agentFilter && inv.salesAgentId !== agentFilter) return false;
      if (branchFilter && inv.branchId !== branchFilter) return false;
      if (currencyFilter && inv.currency !== currencyFilter) return false;
      const total = typeof inv.total === 'number' ? inv.total : 0;
      if (total < min || total > max) return false;
      if (fromTs && inv.date) {
        const t = new Date(inv.date).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && inv.date) {
        const t = new Date(inv.date).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      if (dueFromTs && inv.dueDate) {
        const t = new Date(inv.dueDate).getTime();
        if (!Number.isNaN(t) && t < dueFromTs) return false;
      }
      if (dueToTs && inv.dueDate) {
        const t = new Date(inv.dueDate).getTime();
        if (!Number.isNaN(t) && t > dueToTs) return false;
      }
      return true;
    });
  }, [
    serverInvoices,
    query,
    statusFilter,
    customerFilter,
    agentFilter,
    branchFilter,
    currencyFilter,
    fromDate,
    toDate,
    dueFrom,
    dueTo,
    amountMin,
    amountMax,
  ]);

  /* Bulk-action toggling */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((d) => selected.has(d._id));
  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      if (filtered.length === 0) return prev;
      const allSel = filtered.every((d) => prev.has(d._id));
      if (allSel) {
        const next = new Set(prev);
        for (const d of filtered) next.delete(d._id);
        return next;
      }
      const next = new Set(prev);
      for (const d of filtered) next.add(d._id);
      return next;
    });
  }, [filtered]);

  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter(
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
  }, [filtered, selected, toast]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setCustomerFilter(null);
    setAgentFilter(null);
    setBranchFilter(null);
    setCurrencyFilter(null);
    setFromDate('');
    setToDate('');
    setDueFrom('');
    setDueTo('');
    setAmountMin('');
    setAmountMax('');
    setPreset('all');
  }, []);

  /* Presets */
  const applyPreset = React.useCallback(
    (key: InvoicePresetKey) => {
      setPreset(key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'my-overdue') {
        setStatusFilter('overdue');
        setAgentFilter(currentUserId ?? null);
        setFromDate('');
        setToDate('');
        setDueFrom('');
        setDueTo('');
        return;
      }
      if (key === 'due-this-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        setStatusFilter('all');
        setDueFrom(fmt(today));
        setDueTo(fmt(next7));
        return;
      }
      if (key === 'paid-30d') {
        const prev30 = new Date(today.getTime() - 30 * 86_400_000);
        setStatusFilter('paid');
        setFromDate(fmt(prev30));
        setToDate(fmt(today));
        return;
      }
      if (key === 'draft') {
        setStatusFilter('draft');
        setFromDate('');
        setToDate('');
        setDueFrom('');
        setDueTo('');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk handlers */
  const bulk = useInvoicesBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(customerFilter) ||
    Boolean(agentFilter) ||
    Boolean(branchFilter) ||
    Boolean(currencyFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(dueFrom) ||
    Boolean(dueTo) ||
    Boolean(amountMin) ||
    Boolean(amountMax);

  /* §5.10: Saved-views integration ─────────────────────────────────────── */
  const savedViewFilters = React.useMemo(
    () => ({
      query,
      statusFilter,
      customerFilter,
      agentFilter,
      branchFilter,
      currencyFilter,
      fromDate,
      toDate,
      dueFrom,
      dueTo,
      amountMin,
      amountMax,
      preset,
    }),
    [
      query,
      statusFilter,
      customerFilter,
      agentFilter,
      branchFilter,
      currencyFilter,
      fromDate,
      toDate,
      dueFrom,
      dueTo,
      amountMin,
      amountMax,
      preset,
    ],
  );
  const handleApplyView = React.useCallback((view: SavedView) => {
    const f = (view.filters ?? {}) as Record<string, unknown>;
    if (typeof f.query === 'string') setQuery(f.query);
    if (typeof f.statusFilter === 'string') setStatusFilter(f.statusFilter);
    if (typeof f.customerFilter === 'string' || f.customerFilter === null)
      setCustomerFilter((f.customerFilter as string | null) ?? null);
    if (typeof f.agentFilter === 'string' || f.agentFilter === null)
      setAgentFilter((f.agentFilter as string | null) ?? null);
    if (typeof f.branchFilter === 'string' || f.branchFilter === null)
      setBranchFilter((f.branchFilter as string | null) ?? null);
    if (typeof f.currencyFilter === 'string' || f.currencyFilter === null)
      setCurrencyFilter((f.currencyFilter as string | null) ?? null);
    if (typeof f.fromDate === 'string') setFromDate(f.fromDate);
    if (typeof f.toDate === 'string') setToDate(f.toDate);
    if (typeof f.dueFrom === 'string') setDueFrom(f.dueFrom);
    if (typeof f.dueTo === 'string') setDueTo(f.dueTo);
    if (typeof f.amountMin === 'string') setAmountMin(f.amountMin);
    if (typeof f.amountMax === 'string') setAmountMax(f.amountMax);
    if (typeof f.preset === 'string') setPreset(f.preset as InvoicePresetKey);
  }, []);

  return (
    <>
      <EntityListShell
        title="Invoices"
        subtitle="Bill customers and track payment state across your sales pipeline."
        viewSwitcher={null}
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/invoices/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </ZoruButton>
        }
        bulkBar={
          selected.size > 0 ? (
            <InvoicesBulkBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
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
          filtered.length === 0 && !filtersActive ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Receipt className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No invoices yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Bill your first customer to start tracking sales revenue.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/sales/invoices/new">
                  <Plus className="h-4 w-4" /> New invoice
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
        pagination={
          view === 'table' ? (
            <PaginationBar page={page} limit={limit} hasMore={hasMore} />
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
            active={preset}
            onSelect={applyPreset}
          />

          {error ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
              {error}
            </div>
          ) : null}

          <ZoruCard className="overflow-hidden p-0">
            <InvoicesToolbar
              query={query}
              onQueryChange={setQuery}
              view={view}
              onViewChange={setView}
              density={density}
              onDensityChange={handleDensityChange}
              preset={preset}
              onPresetChange={applyPreset}
              onExportCsv={exportCsv}
            />

            <InvoicesFilters
              filtersActive={filtersActive}
              onClearAll={clearFilters}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              customerFilter={customerFilter}
              onCustomerFilter={setCustomerFilter}
              agentFilter={agentFilter}
              onAgentFilter={setAgentFilter}
              branchFilter={branchFilter}
              onBranchFilter={setBranchFilter}
              currencyFilter={currencyFilter}
              onCurrencyFilter={setCurrencyFilter}
              fromDate={fromDate}
              onFromDate={setFromDate}
              toDate={toDate}
              onToDate={setToDate}
              dueFrom={dueFrom}
              onDueFrom={setDueFrom}
              dueTo={dueTo}
              onDueTo={setDueTo}
              amountMin={amountMin}
              onAmountMin={setAmountMin}
              amountMax={amountMax}
              onAmountMax={setAmountMax}
            />

            {view === 'calendar' ? (
              <div className="p-3">
                <InvoicesCalendar invoices={filtered} />
              </div>
            ) : (
              <InvoicesTable
                invoices={filtered}
                selected={selected}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                allSelectedOnPage={allSelectedOnPage}
                filtersActive={filtersActive}
                density={density}
              />
            )}
          </ZoruCard>
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
