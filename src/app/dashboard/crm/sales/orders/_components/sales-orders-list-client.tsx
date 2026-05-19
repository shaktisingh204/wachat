'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
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
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import {
  AlertCircle,
  ArrowRightCircle,
  LoaderCircle,
  Pencil,
  Trash2,
  Truck,
  } from 'lucide-react';

/**
 * §1D list client for Sales Orders — KPI strip, filter chips, bulk-bar,
 * 12-col table, saved presets.
 *
 * Owns search debounce → URL, status / customer / sales-agent / date /
 * expected-shipment filters → URL, multi-row selection state, and the
 * delete confirmation dialog. Server component re-fetches on URL change.
 *
 * Presentational bits (KPI strip, preset bar, filter toolbar, active
 * chips, bulk-bar, CSV helpers) live in
 * `./sales-orders-list-bits.tsx` so this orchestrator stays under the
 * 600-line per-file cap.
 *
 * Bulk actions: archive · delete · export (CSV) · change status ·
 * convert selection to delivery challans (multi-tab open).
 */

import * as React from 'react';
import Link from 'next/link';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  deleteSalesOrderAction,
  updateSalesOrder,
} from '@/app/actions/crm/sales-orders.actions';
import type {
  CrmSalesOrderDoc,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';
import {
  SoActiveFilterChips,
  SoBulkBar,
  SoFiltersBar,
  SoKpiStrip,
  SoPresetBar,
  soToCsv,
  type SoFilters,
  type SoKpis,
  type SoPreset,
} from './sales-orders-list-bits';

export interface SalesOrdersListClientProps {
  orders: CrmSalesOrderDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  initialClientId: string;
  initialAgentId: string;
  initialDateFrom: string;
  initialDateTo: string;
  initialShipFrom: string;
  initialShipTo: string;
  kpis: SoKpis;
  error?: string;
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function SalesOrdersListClient({
  orders,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  initialClientId,
  initialAgentId,
  initialDateFrom,
  initialDateTo,
  initialShipFrom,
  initialShipTo,
  kpis,
  error,
}: SalesOrdersListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmSalesOrderDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filters: SoFilters = {
    query,
    status: initialStatus,
    clientId: initialClientId,
    agentId: initialAgentId,
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    shipFrom: initialShipFrom,
    shipTo: initialShipTo,
  };

  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      pushParams({ q: query.trim() || undefined, page: '1' });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pushParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function applyPreset(p: SoPreset) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(p.params)) params.set(k, v);
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const allIds = React.useMemo(() => orders.map((o) => String(o._id)), [orders]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function confirmDelete() {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.soNo || id;
    startBusy(async () => {
      const res = await deleteSalesOrderAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }

  function confirmBulkDelete() {
    if (selected.size === 0) return;
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await deleteSalesOrderAction(id);
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

  function bulkStatus(next: CrmSalesOrderStatus) {
    if (selected.size === 0) return;
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        try {
          await updateSalesOrder(id, { status: next });
          ok++;
        } catch {
          fail++;
        }
      }
      toast({
        title: `Updated ${ok}`,
        description: fail > 0 ? `${fail} failed.` : `Status → ${next}.`,
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      router.refresh();
    });
  }

  function bulkExport() {
    const rows = orders.filter((o) => selected.has(String(o._id)));
    const csv = soToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bulkConvertToDc() {
    for (const id of selected) {
      window.open(
        `/dashboard/crm/sales/delivery/new?fromKind=salesOrder&fromId=${id}`,
        '_blank',
      );
    }
  }

  const hasActiveFilters =
    !!initialStatus ||
    !!initialClientId ||
    !!initialAgentId ||
    !!initialDateFrom ||
    !!initialDateTo ||
    !!initialShipFrom ||
    !!initialShipTo;

  return (
    <div className="flex flex-col gap-4">
      <SoKpiStrip
        kpis={kpis}
        currentStatus={initialStatus}
        onClick={(s) => pushParams({ status: initialStatus === s ? undefined : s, page: '1' })}
      />

      <SoPresetBar
        onPreset={applyPreset}
        hasActive={hasActiveFilters}
        onClear={clearAllFilters}
      />

      <ZoruCard className="overflow-hidden p-0">
        <SoFiltersBar
          filters={filters}
          onQueryChange={setQuery}
          onUpdate={pushParams}
        />

        <SoActiveFilterChips
          filters={filters}
          onRemove={(k) => pushParams({ [k]: undefined, page: '1' })}
        />

        {error ? (
          <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <SoBulkBar
          count={selected.size}
          onClear={clearSelection}
          onStatus={bulkStatus}
          onExport={bulkExport}
          onConvertToDc={bulkConvertToDc}
          onArchive={() => bulkStatus('closed')}
          onDelete={() => setPendingBulkDelete(true)}
        />

        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="w-[36px]">
                <ZoruCheckbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </ZoruTableHead>
              <ZoruTableHead>SO #</ZoruTableHead>
              <ZoruTableHead>Customer</ZoruTableHead>
              <ZoruTableHead>Date</ZoruTableHead>
              <ZoruTableHead>Expected shipment</ZoruTableHead>
              <ZoruTableHead>Quotation ref</ZoruTableHead>
              <ZoruTableHead>PO #</ZoruTableHead>
              <ZoruTableHead className="text-right">Total</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead>Sales agent</ZoruTableHead>
              <ZoruTableHead>Created</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {orders.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={12}
                  className="h-24 text-center text-[13px] text-zoru-ink-muted"
                >
                  {initialQuery || hasActiveFilters
                    ? 'No sales orders match these filters.'
                    : 'No sales orders yet — click "New sales order" to add one.'}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              orders.map((order) => {
                const id = String(order._id);
                const isSelected = selected.has(id);
                const agentId = order.assignment?.assignedTo;
                return (
                  <ZoruTableRow key={id} data-state={isSelected ? 'selected' : undefined}>
                    <ZoruTableCell>
                      <ZoruCheckbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Select ${order.soNo}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/orders/${id}`}
                        label={order.soNo || '—'}
                        subtitle={order.poNo ? `PO ${order.poNo}` : fmtDate(order.date)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px]">
                      {order.clientId ? (
                        <EntityPickerChip entity="client" id={order.clientId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {fmtDate(order.date)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {fmtDate(order.expectedShipmentDate)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {order.quotationRef ? (
                        <Link
                          href={`/dashboard/crm/sales/quotations/${order.quotationRef}`}
                          className="hover:underline"
                        >
                          {order.quotationRef.slice(-6)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {order.poNo || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                      {fmtMoney(order.totals?.total, order.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {order.status ? (
                        <StatusPill
                          label={order.status}
                          tone={statusToTone(order.status)}
                        />
                      ) : (
                        <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px]">
                      {agentId ? (
                        <EntityPickerChip entity="user" id={agentId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {fmtDate(order.createdAt || order.audit?.createdAt)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ZoruButton size="sm" variant="ghost" asChild title="Convert to delivery challan">
                          <Link
                            href={`/dashboard/crm/sales/delivery/new?fromKind=salesOrder&fromId=${id}`}
                          >
                            <Truck className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton size="sm" variant="ghost" asChild title="Convert to invoice">
                          <Link
                            href={`/dashboard/crm/sales/invoices/new?fromKind=salesOrder&fromId=${id}`}
                          >
                            <ArrowRightCircle className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/sales/orders/${id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(order)}
                          className="text-zoru-danger-ink"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ZoruButton>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })
            )}
          </ZoruTableBody>
        </ZoruTable>

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />

        <ZoruAlertDialog
          open={pendingDelete !== null}
          onOpenChange={(o) => !o && setPendingDelete(null)}
        >
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Delete sales order?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                This permanently removes <strong>{pendingDelete?.soNo ?? ''}</strong>{' '}
                from the database. The action cannot be undone.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
                disabled={busy}
                className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
              >
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                Delete permanently
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>

        <ZoruAlertDialog
          open={pendingBulkDelete}
          onOpenChange={(o) => !o && setPendingBulkDelete(false)}
        >
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Delete {selected.size} sales orders?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                This permanently removes the selected sales orders. The action
                cannot be undone.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmBulkDelete();
                }}
                disabled={busy}
                className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
              >
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                Delete permanently
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>
      </ZoruCard>
    </div>
  );
}
