'use client';

/**
 * <PurchaseOrdersListClient> — inventory purchase-orders list view.
 *
 * Ships:
 *   - KPI strip (from kpi prop)
 *   - Filters (status, vendor, date range)
 *   - Checkbox row selection
 *   - Bulk bar (approve, cancel, delete with confirm)
 *   - Export CSV + XLSX
 *   - Pagination
 */

import * as React from 'react';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast, DropdownMenu, ZoruDropdownMenuTrigger, ZoruDropdownMenuContent, ZoruDropdownMenuItem,
} from '@/components/zoruui';
import { CheckCheck, Download, Trash2, X, XCircle, MoreHorizontal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { fmtDate } from '@/lib/utils';

import {
  bulkApprovePurchaseOrders,
  bulkDeletePurchaseOrders,
  bulkChangePurchaseOrderStatus,
} from '@/app/actions/crm/purchase-orders.actions';
import type { PurchaseOrderKpiSummary } from '@/app/actions/crm/purchase-orders.kpis';
import type { PurchaseOrderListRow } from './types';

/* ─── Status badge ─────────────────────────────────────────────────── */

const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline'
> = {
  draft: 'outline',
  awaiting_approval: 'warning',
  approved: 'success',
  sent: 'info',
  partial: 'warning',
  received: 'success',
  closed: 'default',
  cancelled: 'destructive',
};

function StatusBadge({ status }: { status: string | undefined }) {
  const s = (status ?? 'draft').toLowerCase();
  const variant = STATUS_VARIANT[s] ?? 'outline';
  const label = s.replace(/_/g, ' ');
  return <Badge variant={variant}>{label}</Badge>;
}

/* ─── KPI card ─────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col gap-1 rounded-lg border border-zoru-line bg-zoru-surface p-3 text-left transition hover:border-zoru-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        active ? 'border-zoru-primary ring-1 ring-zoru-primary' : '',
      ].join(' ')}
    >
      <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">{label}</span>
      <span className="text-xl font-semibold text-zoru-ink">{value}</span>
    </button>
  );
}

/* ─── Currency formatter ───────────────────────────────────────────── */

function fmt(v: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}

/* ─── Props ────────────────────────────────────────────────────────── */

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

const EXPORT_HEADERS = [
  'PO #',
  'Vendor',
  'Date',
  'Expected Delivery',
  'Currency',
  'Total',
  'Status',
  'Created',
];

/* ─── Component ────────────────────────────────────────────────────── */

export function PurchaseOrdersListClient({
  orders: serverOrders,
  page,
  limit,
  hasMore,
  initialQuery,
  kpi,
  error,
}: PurchaseOrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useZoruToast();

  /* Filters */
  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [kpiFilter, setKpiFilter] = React.useState<string>(searchParams?.get('tab') || 'all');

  React.useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && tab !== kpiFilter) {
      updateTab(tab);
    }
  }, [searchParams]);

  const updateTab = (tab: string) => {
    updateTab(tab);
    const params = new URLSearchParams(searchParams?.toString());
    if (tab === 'all') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`?${params.toString()}`);
  };

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Confirm dialogs */
  const [approvePending, setApprovePending] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [bulkPending, startBulkTransition] = React.useTransition();

  /* Filtered list */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    return serverOrders.filter((po) => {
      if (q) {
        const hay = `${po.poNo ?? ''} ${po.vendorLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const s = (po.status ?? '').toLowerCase();
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      if (kpiFilter === 'draft' && s !== 'draft') return false;
      if (kpiFilter === 'awaiting_approval' && s !== 'awaiting_approval') return false;
      if (kpiFilter === 'approved' && s !== 'approved' && s !== 'sent') return false;
      if (kpiFilter === 'received' && s !== 'received' && s !== 'closed') return false;
      if (fromTs && po.date) {
        const t = new Date(po.date).getTime();
        if (!Number.isNaN(t) && t < fromTs) return false;
      }
      if (toTs && po.date) {
        const t = new Date(po.date).getTime();
        if (!Number.isNaN(t) && t > toTs) return false;
      }
      return true;
    });
  }, [serverOrders, query, statusFilter, fromDate, toDate, kpiFilter]);

  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

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
      if (filtered.length === 0) return prev;
      const allSel = filtered.every((r) => prev.has(r._id));
      if (allSel) {
        const next = new Set(prev);
        for (const r of filtered) next.delete(r._id);
        return next;
      }
      const next = new Set(prev);
      for (const r of filtered) next.add(r._id);
      return next;
    });
  }, [filtered]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    updateTab('all');
  }, []);

  const filtersActive =
    Boolean(query) ||
    statusFilter !== 'all' ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    kpiFilter !== 'all';

  /* Export */
  const toExportRows = React.useCallback(
    (rows: PurchaseOrderListRow[]) =>
      rows.map((r) => ({
        'PO #': r.poNo,
        Vendor: r.vendorLabel ?? r.vendorId ?? '',
        Date: r.date ?? '',
        'Expected Delivery': r.expectedDelivery ?? '',
        Currency: r.currency ?? '',
        Total: r.total ?? '',
        Status: r.status ?? '',
        Created: r.createdAt ?? '',
      })),
    [],
  );

  const exportRows = React.useCallback(
    () => filtered.filter((r) => selected.size === 0 || selected.has(r._id)),
    [filtered, selected],
  );

  const handleExportCsv = React.useCallback(() => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    downloadCsv(`inventory-purchase-orders-${dateStamp()}.csv`, EXPORT_HEADERS, toExportRows(rows));
    toast({ title: 'Exported', description: `${rows.length} purchase orders saved to CSV.` });
  }, [exportRows, toExportRows, toast]);

  const handleExportXlsx = React.useCallback(async () => {
    const rows = exportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    await downloadXlsx(
      `inventory-purchase-orders-${dateStamp()}.xlsx`,
      EXPORT_HEADERS,
      toExportRows(rows),
      'Purchase Orders',
    );
    toast({ title: 'Exported', description: `${rows.length} purchase orders saved to XLSX.` });
  }, [exportRows, toExportRows, toast]);

  /* Bulk handlers */
  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);

  const runApprove = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkApprovePurchaseOrders(selectedIds);
      if (res.success) {
        toast({ title: `${res.processed} order${res.processed === 1 ? '' : 's'} approved` });
        setSelected(new Set());
        router.refresh();
      } else {
        toast({ title: 'Approve failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selectedIds, router, toast]);

  const runCancel = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkChangePurchaseOrderStatus(selectedIds, 'cancelled');
      if (res.success) {
        toast({ title: `${res.processed} order${res.processed === 1 ? '' : 's'} cancelled` });
        setSelected(new Set());
        router.refresh();
      } else {
        toast({ title: 'Cancel failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selectedIds, router, toast]);

  const runDelete = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkDeletePurchaseOrders(selectedIds);
      if (res.success) {
        toast({ title: `${res.processed} order${res.processed === 1 ? '' : 's'} deleted` });
        setSelected(new Set());
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selectedIds, router, toast]);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Purchase Orders"
        subtitle="Inventory procurement — approve, track and receive vendor orders."
        search={{ value: query, onChange: setQuery, placeholder: 'Search PO #, vendor…' }}
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <ZoruSelectTrigger className="h-8 w-[160px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                  <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="awaiting_approval">Awaiting approval</ZoruSelectItem>
                  <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                  <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
                  <ZoruSelectItem value="partial">Partial</ZoruSelectItem>
                  <ZoruSelectItem value="received">Received</ZoruSelectItem>
                  <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                  <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Date from
              </Label>
              <Input
                type="date"
                className="h-8 w-[140px] text-[13px]"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Date to
              </Label>
              <Input
                type="date"
                className="h-8 w-[140px] text-[13px]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{selected.size} selected</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setApprovePending(true)}
                disabled={bulkPending}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelPending(true)}
                disabled={bulkPending}
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleExportXlsx()}
              >
                <Download className="h-3.5 w-3.5" /> XLSX
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeletePending(true)}
                disabled={bulkPending}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          ) : null
        }
      >
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          <KpiCard
            label="Total"
            value={(
              kpi.draftCount +
              kpi.awaitingApprovalCount +
              kpi.approvedCount +
              kpi.partialCount +
              kpi.closedCount
            ).toLocaleString()}
            active={kpiFilter === 'all'}
            onClick={() => updateTab('all')}
          />
          <KpiCard
            label="Draft"
            value={kpi.draftCount.toLocaleString()}
            active={kpiFilter === 'draft'}
            onClick={() => updateTab(kpiFilter === 'draft' ? 'all' : 'draft')}
          />
          <KpiCard
            label="Awaiting approval"
            value={kpi.awaitingApprovalCount.toLocaleString()}
            active={kpiFilter === 'awaiting_approval'}
            onClick={() =>
              updateTab(kpiFilter === 'awaiting_approval' ? 'all' : 'awaiting_approval')
            }
          />
          <KpiCard
            label="Approved"
            value={kpi.approvedCount.toLocaleString()}
            active={kpiFilter === 'approved'}
            onClick={() => updateTab(kpiFilter === 'approved' ? 'all' : 'approved')}
          />
          <KpiCard
            label="Received / closed"
            value={kpi.closedCount.toLocaleString()}
            active={kpiFilter === 'received'}
            onClick={() => updateTab(kpiFilter === 'received' ? 'all' : 'received')}
          />
        </div>

        {error ? (
          <div className="rounded border border-zoru-line/40 bg-zoru-ink/10 px-3 py-2 text-[12.5px] text-zoru-ink dark:text-zoru-ink-muted">
            {error}
          </div>
        ) : null}

        {/* Export bar */}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleExportXlsx()}>
            <Download className="h-3.5 w-3.5" /> Export XLSX
          </Button>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10 pl-3">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all on page"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>PO #</ZoruTableHead>
                  <ZoruTableHead>Vendor</ZoruTableHead>
                  <ZoruTableHead>Date</ZoruTableHead>
                  <ZoruTableHead>Expected</ZoruTableHead>
                  <ZoruTableHead className="text-right">Total</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="w-10"></ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filtered.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {filtersActive
                        ? 'No purchase orders match the current filters.'
                        : 'No purchase orders yet.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filtered.map((po) => (
                    <ZoruTableRow key={po._id} className="border-zoru-line">
                      <ZoruTableCell className="pl-3">
                        <Checkbox
                          checked={selected.has(po._id)}
                          onCheckedChange={() => toggleRow(po._id)}
                          aria-label={`Select ${po.poNo}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/inventory/purchase-orders/${po._id}`}
                          label={po.poNo}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {po.vendorLabel ?? po.vendorId ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                        {fmtDate(po.date)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                        {fmtDate(po.expectedDelivery)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-ink">
                        {fmt(po.total, po.currency ?? 'INR')}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusBadge status={po.status} />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <DropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem onClick={() => router.push(`/dashboard/crm/inventory/purchase-orders/${po._id}`)}>
                              View details
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onClick={() => { setSelected(new Set([po._id])); setApprovePending(true); }}>
                              Approve
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onClick={() => { setSelected(new Set([po._id])); setCancelPending(true); }}>
                              Cancel
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem className="text-zoru-ink" onClick={() => { setSelected(new Set([po._id])); setDeletePending(true); }}>
                              Delete
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </DropdownMenu>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </Table>
          </div>
        </Card>

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </EntityListShell>

      <ConfirmDialog
        open={approvePending}
        onOpenChange={setApprovePending}
        title={`Approve ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="Marks the selected purchase orders as approved and ready to send."
        confirmLabel="Approve"
        confirmTone="primary"
        onConfirm={runApprove}
      />
      <ConfirmDialog
        open={cancelPending}
        onOpenChange={setCancelPending}
        title={`Cancel ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="Sets the selected purchase orders to cancelled. This can be reversed by changing the status."
        confirmLabel="Cancel orders"
        confirmTone="danger"
        onConfirm={runCancel}
      />
      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} purchase order${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected purchase orders. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={runDelete}
      />

      {bulkPending ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
