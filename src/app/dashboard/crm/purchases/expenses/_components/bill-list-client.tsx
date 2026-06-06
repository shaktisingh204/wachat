'use client';

import { Card, useToast } from '@/components/sabcrm/20ui/compat';
/**
 * <BillListClient> — canonical Bills list view per CRM_REBUILD_PLAN §1D.
 *
 * Ships:
 *   - KPI strip (outstanding, overdue, paid this month, drafts, avg days)
 *   - View switcher (table | calendar)
 *   - Filters (status, vendor, project, branch, currency, bill date
 *     range, due date range, amount range)
 *   - Saved filter presets ("All", "My overdue", "Due this week",
 *     "Paid last 30 days", "Drafts")
 *   - Density toggle (Comfortable / Compact / Dense)
 *   - Search across bill no, vendor invoice no, vendor name
 *   - Bulk-action bar (archive / delete / export CSV / mark paid /
 *     change status)
 *
 * Mirrors `<InvoiceListClient>` shape one-for-one — see that file for
 * the architectural rationale.
 */

import * as React from 'react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  dateStamp,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

import { BillsKpiStrip } from './bills-kpi-strip';
import { BillsToolbar } from './bills-toolbar';
import { BillsBulkBar } from './bills-bulk-bar';
import { BillsTable } from './bills-table';
import { BillsCalendar } from './bills-calendar';
import { BillsFilters } from './bills-filters';
import { useBillsBulk } from './use-bills-bulk';
import type {
  BillDensity,
  BillKpiSnapshot,
  BillListRow,
  BillPresetKey,
  BillViewMode,
} from './types';

interface BillListClientProps {
  bills: BillListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: BillKpiSnapshot;
  defaultCurrency: string;
  currentUserId?: string | null;
  error?: string;
}

const DENSITY_KEY = 'crm.bills.density';

function toCsv(rows: BillListRow[]): string {
  const head = [
    'billNo',
    'vendorInvoiceNo',
    'vendor',
    'billDate',
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
      r.billNo,
      r.vendorInvoiceNo ?? '',
      r.vendorLabel ?? r.vendorId ?? '',
      r.billDate ?? '',
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

function isOverdue(row: BillListRow): boolean {
  if (!row.dueDate) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'paid' || s === 'cancelled') return false;
  const t = new Date(row.dueDate).getTime();
  return !Number.isNaN(t) && t < Date.now() && (row.balance ?? 0) > 0;
}

export function BillListClient({
  bills: serverBills,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  defaultCurrency,
  error,
}: BillListClientProps) {
  const { toast } = useToast();

  /* View + density */
  const [view, setView] = React.useState<BillViewMode>('table');
  const [density, setDensity] = React.useState<BillDensity>('comfortable');

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
  const handleDensityChange = React.useCallback((next: BillDensity) => {
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
  const [vendorFilter, setVendorFilter] = React.useState<string | null>(null);
  const [projectFilter, setProjectFilter] = React.useState<string | null>(null);
  const [branchFilter, setBranchFilter] = React.useState<string | null>(null);
  const [currencyFilter, setCurrencyFilter] = React.useState<string | null>(
    null,
  );
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [dueFrom, setDueFrom] = React.useState('');
  const [dueTo, setDueTo] = React.useState('');
  const [amountMin, setAmountMin] = React.useState('');
  const [amountMax, setAmountMax] = React.useState('');
  const [preset, setPreset] = React.useState<BillPresetKey>('all');

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

  /* Filtered view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY;
    const max = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY;
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    const dueFromTs = dueFrom ? new Date(dueFrom).getTime() : null;
    const dueToTs = dueTo ? new Date(dueTo).getTime() : null;

    return serverBills.filter((bill) => {
      if (q) {
        const hay =
          `${bill.billNo ?? ''} ${bill.vendorInvoiceNo ?? ''} ${bill.vendorLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const s = (bill.status ?? '').toLowerCase();
      if (statusFilter === 'overdue') {
        if (!isOverdue(bill)) return false;
      } else if (statusFilter !== 'all' && s !== statusFilter) {
        return false;
      }
      if (vendorFilter && bill.vendorId !== vendorFilter) return false;
      if (projectFilter && bill.projectId !== projectFilter) return false;
      if (branchFilter && bill.branchId !== branchFilter) return false;
      if (currencyFilter && bill.currency !== currencyFilter) return false;
      const total = typeof bill.total === 'number' ? bill.total : 0;
      if (total < min || total > max) return false;
      if (fromTs && bill.billDate) {
        const t = new Date(bill.billDate).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && bill.billDate) {
        const t = new Date(bill.billDate).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      if (dueFromTs && bill.dueDate) {
        const t = new Date(bill.dueDate).getTime();
        if (!Number.isNaN(t) && t < dueFromTs) return false;
      }
      if (dueToTs && bill.dueDate) {
        const t = new Date(bill.dueDate).getTime();
        if (!Number.isNaN(t) && t > dueToTs) return false;
      }
      return true;
    });
  }, [
    serverBills,
    query,
    statusFilter,
    vendorFilter,
    projectFilter,
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

  const buildExportRows = React.useCallback(
    (rows: BillListRow[]): { headers: string[]; rows: ExportRow[] } => {
      const headers = [
        'billNo',
        'vendorInvoiceNo',
        'vendor',
        'billDate',
        'dueDate',
        'currency',
        'total',
        'paid',
        'balance',
        'status',
        'createdAt',
      ];
      const out: ExportRow[] = rows.map((r) => ({
        billNo: r.billNo,
        vendorInvoiceNo: r.vendorInvoiceNo ?? '',
        vendor: r.vendorLabel ?? r.vendorId ?? '',
        billDate: r.billDate ?? '',
        dueDate: r.dueDate ?? '',
        currency: r.currency ?? '',
        total: r.total ?? '',
        paid: r.paid ?? '',
        balance: r.balance ?? '',
        status: r.status ?? '',
        createdAt: r.createdAt ?? '',
      }));
      return { headers, rows: out };
    },
    [],
  );

  const exportXlsx = React.useCallback(async () => {
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
    const projected = buildExportRows(rows);
    await downloadXlsx(
      `bills-${dateStamp()}.xlsx`,
      projected.headers,
      projected.rows,
      'Bills',
    );
    toast({
      title: 'Exported',
      description: `${rows.length} bills saved to XLSX.`,
    });
  }, [filtered, selected, toast, buildExportRows]);

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
    a.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} bills saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setVendorFilter(null);
    setProjectFilter(null);
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

  const applyPreset = React.useCallback(
    (key: BillPresetKey) => {
      setPreset(key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'my-overdue') {
        setStatusFilter('overdue');
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
    [clearFilters],
  );

  const bulk = useBillsBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(vendorFilter) ||
    Boolean(projectFilter) ||
    Boolean(branchFilter) ||
    Boolean(currencyFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(dueFrom) ||
    Boolean(dueTo) ||
    Boolean(amountMin) ||
    Boolean(amountMax);

  return (
    <div className="flex w-full flex-col gap-5">
      <BillsKpiStrip
        kpi={kpi}
        currency={defaultCurrency}
        active={preset}
        onSelect={applyPreset}
      />

      {error ? (
        <div className="rounded border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-3 py-2 text-[12.5px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <BillsToolbar
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

        <BillsFilters
          filtersActive={filtersActive}
          onClearAll={clearFilters}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          vendorFilter={vendorFilter}
          onVendorFilter={setVendorFilter}
          projectFilter={projectFilter}
          onProjectFilter={setProjectFilter}
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

        <BillsBulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onExportCsv={exportCsv}
          onExportXlsx={exportXlsx}
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onMarkPaid={() => setMarkPaidPending(true)}
          onChangeStatus={bulk.changeStatus}
        />

        {view === 'calendar' ? (
          <div className="p-3">
            <BillsCalendar bills={filtered} />
          </div>
        ) : (
          <BillsTable
            bills={filtered}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            allSelectedOnPage={allSelectedOnPage}
            filtersActive={filtersActive}
            density={density}
          />
        )}

        {view === 'table' ? (
          <div className="border-t border-[var(--st-border)] p-3">
            <PaginationBar page={page} limit={limit} hasMore={hasMore} />
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} bill${selected.size === 1 ? '' : 's'}?`}
        description="Archived bills are marked cancelled and hidden from default views."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} bill${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected bills. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      <ConfirmDialog
        open={markPaidPending}
        onOpenChange={setMarkPaidPending}
        title={`Mark ${selected.size} bill${selected.size === 1 ? '' : 's'} paid?`}
        description="Updates the status to paid. Use Record payout if you need to capture amounts and methods."
        confirmLabel="Mark paid"
        confirmTone="primary"
        onConfirm={async () => bulk.markPaid()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
