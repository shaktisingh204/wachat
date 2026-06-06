'use client';

import { Card, useToast } from '@/components/sabcrm/20ui';
/**
 * <PurchaseOrdersListClient> — canonical PO list view per
 * CRM_REBUILD_PLAN §1D.1.
 *
 * Ships:
 *   - KPI strip (Draft / Awaiting approval / Approved / Partial / Closed)
 *   - View switcher (table | calendar by expected delivery)
 *   - Filters (status, vendor, owner, branch, approval-status, PO date
 *     range, expected-delivery range, amount range)
 *   - Saved filter presets ("All open", "My pending approval",
 *     "Overdue delivery", "Closed last 30d", "Drafts")
 *   - Density toggle (Comfortable / Compact / Dense)
 *   - Search across PO number, vendor name
 *   - Bulk-action bar (archive / delete / export CSV / approve / send /
 *     change status / convert to GRN)
 */

import * as React from 'react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import type { PurchaseOrderKpiSummary } from '@/app/actions/crm/purchase-orders.kpis';

import { PurchaseOrdersKpiStrip } from './purchase-orders-kpi-strip';
import { PurchaseOrdersToolbar } from './purchase-orders-toolbar';
import { PurchaseOrdersBulkBar } from './purchase-orders-bulk-bar';
import { PurchaseOrdersTable } from './purchase-orders-table';
import { PurchaseOrdersCalendar } from './purchase-orders-calendar';
import { PurchaseOrdersFilters } from './purchase-orders-filters';
import { usePurchaseOrdersBulk } from './use-purchase-orders-bulk';
import type {
  PurchaseOrderDensity,
  PurchaseOrderListRow,
  PurchaseOrderPresetKey,
  PurchaseOrderViewMode,
} from './types';

interface PurchaseOrdersListClientProps {
  orders: PurchaseOrderListRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpi: PurchaseOrderKpiSummary;
  currentUserId?: string | null;
  error?: string;
}

const DENSITY_KEY = 'crm.purchaseOrders.density';

function toCsv(rows: PurchaseOrderListRow[]): string {
  const head = [
    'poNo',
    'vendor',
    'date',
    'expectedDelivery',
    'currency',
    'total',
    'status',
    'buyer',
    'approver',
    'createdAt',
  ];
  const body = rows.map((r) =>
    [
      r.poNo,
      r.vendorLabel ?? r.vendorId ?? '',
      r.date ?? '',
      r.expectedDelivery ?? '',
      r.currency ?? '',
      r.total ?? '',
      r.status ?? '',
      r.buyerId ?? '',
      r.approverId ?? '',
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

function isDeliveryOverdue(row: PurchaseOrderListRow): boolean {
  if (!row.expectedDelivery) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'received' || s === 'closed' || s === 'cancelled') return false;
  const t = new Date(row.expectedDelivery).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export function PurchaseOrdersListClient({
  orders: serverOrders,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  currentUserId,
  error,
}: PurchaseOrdersListClientProps) {
  const { toast } = useToast();

  /* View + density */
  const [view, setView] = React.useState<PurchaseOrderViewMode>('table');
  const [density, setDensity] =
    React.useState<PurchaseOrderDensity>('comfortable');

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
  const handleDensityChange = React.useCallback(
    (next: PurchaseOrderDensity) => {
      setDensity(next);
      try {
        window.localStorage.setItem(DENSITY_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  /* Filters */
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [vendorFilter, setVendorFilter] = React.useState<string | null>(null);
  const [buyerFilter, setBuyerFilter] = React.useState<string | null>(null);
  const [branchFilter, setBranchFilter] = React.useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = React.useState<string>('any');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [expectedFrom, setExpectedFrom] = React.useState('');
  const [expectedTo, setExpectedTo] = React.useState('');
  const [amountMin, setAmountMin] = React.useState('');
  const [amountMax, setAmountMax] = React.useState('');
  const [preset, setPreset] = React.useState<PurchaseOrderPresetKey>('all');

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
  const [approvePending, setApprovePending] = React.useState(false);
  const [sendPending, setSendPending] = React.useState(false);

  /* Filtered view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY;
    const max = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY;
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    const expectedFromTs = expectedFrom ? new Date(expectedFrom).getTime() : null;
    const expectedToTs = expectedTo ? new Date(expectedTo).getTime() : null;

    return serverOrders.filter((po) => {
      if (q) {
        const hay = `${po.poNo ?? ''} ${po.vendorLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const s = (po.status ?? '').toLowerCase();
      if (statusFilter === 'overdue') {
        if (!isDeliveryOverdue(po)) return false;
      } else if (statusFilter !== 'all' && s !== statusFilter) {
        return false;
      }
      if (vendorFilter && po.vendorId !== vendorFilter) return false;
      if (buyerFilter && po.buyerId !== buyerFilter) return false;
      if (branchFilter && po.branchId !== branchFilter) return false;
      if (approvalFilter === 'pending' && s !== 'awaiting_approval')
        return false;
      if (
        approvalFilter === 'approved' &&
        s !== 'approved' &&
        s !== 'sent' &&
        s !== 'partial' &&
        s !== 'received' &&
        s !== 'closed'
      )
        return false;
      const total = typeof po.total === 'number' ? po.total : 0;
      if (total < min || total > max) return false;
      if (fromTs && po.date) {
        const t = new Date(po.date).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && po.date) {
        const t = new Date(po.date).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      if (expectedFromTs && po.expectedDelivery) {
        const t = new Date(po.expectedDelivery).getTime();
        if (!Number.isNaN(t) && t < expectedFromTs) return false;
      }
      if (expectedToTs && po.expectedDelivery) {
        const t = new Date(po.expectedDelivery).getTime();
        if (!Number.isNaN(t) && t > expectedToTs) return false;
      }
      return true;
    });
  }, [
    serverOrders,
    query,
    statusFilter,
    vendorFilter,
    buyerFilter,
    branchFilter,
    approvalFilter,
    fromDate,
    toDate,
    expectedFrom,
    expectedTo,
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
    a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `${rows.length} purchase orders saved to CSV.`,
    });
  }, [filtered, selected, toast]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setVendorFilter(null);
    setBuyerFilter(null);
    setBranchFilter(null);
    setApprovalFilter('any');
    setFromDate('');
    setToDate('');
    setExpectedFrom('');
    setExpectedTo('');
    setAmountMin('');
    setAmountMax('');
    setPreset('all');
  }, []);

  /* Presets */
  const applyPreset = React.useCallback(
    (key: PurchaseOrderPresetKey) => {
      setPreset(key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'all-open') {
        // Anything not closed/received/cancelled.
        setStatusFilter('all');
        setApprovalFilter('any');
        setFromDate('');
        setToDate('');
        setExpectedFrom('');
        setExpectedTo('');
        return;
      }
      if (key === 'my-pending-approval') {
        setStatusFilter('awaiting_approval');
        setApprovalFilter('pending');
        setBuyerFilter(currentUserId ?? null);
        setFromDate('');
        setToDate('');
        return;
      }
      if (key === 'overdue-delivery') {
        setStatusFilter('overdue');
        setExpectedFrom('');
        setExpectedTo(fmt(today));
        return;
      }
      if (key === 'closed-30d') {
        const prev30 = new Date(today.getTime() - 30 * 86_400_000);
        setStatusFilter('closed');
        setFromDate(fmt(prev30));
        setToDate(fmt(today));
        return;
      }
      if (key === 'drafts') {
        setStatusFilter('draft');
        setFromDate('');
        setToDate('');
        setExpectedFrom('');
        setExpectedTo('');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk handlers */
  const bulk = usePurchaseOrdersBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(vendorFilter) ||
    Boolean(buyerFilter) ||
    Boolean(branchFilter) ||
    approvalFilter !== 'any' ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(expectedFrom) ||
    Boolean(expectedTo) ||
    Boolean(amountMin) ||
    Boolean(amountMax);

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* KPI strip */}
      <PurchaseOrdersKpiStrip kpi={kpi} active={preset} onSelect={applyPreset} />

      {error ? (
        <div className="rounded border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-3 py-2 text-[12.5px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <PurchaseOrdersToolbar
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

        <PurchaseOrdersFilters
          filtersActive={filtersActive}
          onClearAll={clearFilters}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          vendorFilter={vendorFilter}
          onVendorFilter={setVendorFilter}
          buyerFilter={buyerFilter}
          onBuyerFilter={setBuyerFilter}
          branchFilter={branchFilter}
          onBranchFilter={setBranchFilter}
          approvalFilter={approvalFilter}
          onApprovalFilter={setApprovalFilter}
          fromDate={fromDate}
          onFromDate={setFromDate}
          toDate={toDate}
          onToDate={setToDate}
          expectedFrom={expectedFrom}
          onExpectedFrom={setExpectedFrom}
          expectedTo={expectedTo}
          onExpectedTo={setExpectedTo}
          amountMin={amountMin}
          onAmountMin={setAmountMin}
          amountMax={amountMax}
          onAmountMax={setAmountMax}
        />

        <PurchaseOrdersBulkBar
          count={selected.size}
          selectedIds={selectedIds}
          onClear={() => setSelected(new Set())}
          onExportCsv={exportCsv}
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onApprove={() => setApprovePending(true)}
          onSend={() => setSendPending(true)}
          onChangeStatus={bulk.changeStatus}
        />

        {view === 'calendar' ? (
          <div className="p-3">
            <PurchaseOrdersCalendar orders={filtered} />
          </div>
        ) : (
          <PurchaseOrdersTable
            orders={filtered}
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
        title={`Archive ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="Archived purchase orders are marked cancelled and hidden from default views."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected purchase orders. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      <ConfirmDialog
        open={approvePending}
        onOpenChange={setApprovePending}
        title={`Approve ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="Marks the selected purchase orders as approved and ready to send."
        confirmLabel="Approve"
        confirmTone="primary"
        onConfirm={async () => bulk.approve()}
      />

      <ConfirmDialog
        open={sendPending}
        onOpenChange={setSendPending}
        title={`Send ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="Marks these purchase orders as sent. Email delivery is handled by your messaging settings."
        confirmLabel="Send"
        confirmTone="primary"
        onConfirm={async () => bulk.send()}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
