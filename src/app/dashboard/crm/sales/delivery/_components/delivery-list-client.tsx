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
  } from 'lucide-react';

/**
 * §1D list client for Delivery Challans — thin-§1D variant per the
 * rebuild plan's scope cap (activity sub-route + density toggle
 * deferred).
 *
 * Presentational bits (KPI strip, filter toolbar, chips, bulk-bar, CSV
 * helpers) live in `./delivery-list-bits.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, Truck } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { deleteDeliveryChallanAction } from '@/app/actions/crm-delivery-challans.actions';
import {
  DcActiveFilterChips,
  DcBulkBar,
  DcFiltersBar,
  DcKpiStrip,
  dcToCsv,
  type DcFilters,
  type DcKpis,
  type DcRow,
  type DcStatus,
} from './delivery-list-bits';

export type { DcStatus, DcRow, DcKpis };

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export interface DeliveryListClientProps {
  rows: DcRow[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  initialClientId: string;
  initialTransporterId: string;
  initialDateFrom: string;
  initialDateTo: string;
  initialWarehouseId: string;
  kpis: DcKpis;
  error?: string;
}

export function DeliveryListClient({
  rows,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  initialClientId,
  initialTransporterId,
  initialDateFrom,
  initialDateTo,
  initialWarehouseId,
  kpis,
  error,
}: DeliveryListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<DcRow | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filters: DcFilters = {
    query,
    status: initialStatus,
    clientId: initialClientId,
    transporterId: initialTransporterId,
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    warehouseId: initialWarehouseId,
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

  function clearAllFilters() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const allIds = React.useMemo(() => rows.map((r) => r._id), [rows]);
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
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    const label = pendingDelete.challanNumber || id;
    startBusy(async () => {
      const res = await deleteDeliveryChallanAction(id);
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
        const res = await deleteDeliveryChallanAction(id);
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

  function bulkExport() {
    const sel = rows.filter((r) => selected.has(r._id));
    const csv = dcToCsv(sel);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery-challans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bulkConvertToInvoice() {
    for (const id of selected) {
      window.open(
        `/dashboard/crm/sales/invoices/new?fromKind=deliveryChallan&fromId=${id}`,
        '_blank',
      );
    }
  }

  const hasActive =
    !!initialStatus ||
    !!initialClientId ||
    !!initialTransporterId ||
    !!initialWarehouseId ||
    !!initialDateFrom ||
    !!initialDateTo;

  return (
    <>
    <EntityListShell
      title="Delivery Challans"
      subtitle="Create, share, and track delivery challans."
      search={{
        value: query,
        onChange: setQuery,
        placeholder: 'Search challans…',
      }}
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/sales/delivery/new">
            <Plus className="h-4 w-4" /> New challan
          </Link>
        </ZoruButton>
      }
      bulkBar={
        selected.size > 0 ? (
          <DcBulkBar
            count={selected.size}
            onClear={clearSelection}
            onExport={bulkExport}
            onConvertToInvoice={bulkConvertToInvoice}
            onDelete={() => setPendingBulkDelete(true)}
          />
        ) : null
      }
      empty={
        rows.length === 0 && !initialQuery && !hasActive ? (
          <div className="flex flex-col items-center gap-3 p-4">
            <Truck className="h-8 w-8 text-zoru-ink-muted" />
            <h3 className="text-base font-medium text-zoru-ink">No delivery challans yet</h3>
            <p className="max-w-sm text-sm text-zoru-ink-muted">
              Create a delivery challan to track goods dispatched to customers.
            </p>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/sales/delivery/new">
                <Plus className="h-4 w-4" /> New challan
              </Link>
            </ZoruButton>
          </div>
        ) : null
      }
      pagination={<PaginationBar page={page} limit={limit} hasMore={hasMore} />}
    >
      <div className="flex flex-col gap-5">
        <DcKpiStrip
          kpis={kpis}
          currentStatus={initialStatus}
          onClick={(s) => pushParams({ status: initialStatus === s ? undefined : s, page: '1' })}
        />

        {error ? (
          <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <ZoruCard className="overflow-hidden p-0">
          <DcFiltersBar
            filters={filters}
            onQueryChange={setQuery}
            onUpdate={pushParams}
            hasActive={hasActive}
            onClear={clearAllFilters}
          />

          <DcActiveFilterChips
            filters={filters}
            onRemove={(k) => pushParams({ [k]: undefined, page: '1' })}
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
              <ZoruTableHead>Challan #</ZoruTableHead>
              <ZoruTableHead>Customer</ZoruTableHead>
              <ZoruTableHead>SO ref</ZoruTableHead>
              <ZoruTableHead>Date</ZoruTableHead>
              <ZoruTableHead>Vehicle #</ZoruTableHead>
              <ZoruTableHead>Driver</ZoruTableHead>
              <ZoruTableHead>Transporter</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {rows.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={10}
                  className="h-24 text-center text-[13px] text-zoru-ink-muted"
                >
                  {initialQuery || hasActive
                    ? 'No delivery challans match these filters.'
                    : 'No delivery challans yet — click "New challan" to add one.'}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              rows.map((dc) => {
                const isSelected = selected.has(dc._id);
                return (
                  <ZoruTableRow key={dc._id} data-state={isSelected ? 'selected' : undefined}>
                    <ZoruTableCell>
                      <ZoruCheckbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(dc._id)}
                        aria-label={`Select ${dc.challanNumber}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/delivery/${dc._id}`}
                        label={dc.challanNumber || '—'}
                        subtitle={fmtDate(dc.challanDate)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px]">
                      {dc.accountId ? (
                        <EntityPickerChip entity="client" id={dc.accountId} />
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {dc.soRef ? (
                        <Link
                          href={`/dashboard/crm/sales/orders/${dc.soRef}`}
                          className="hover:underline"
                        >
                          {dc.soRef.slice(-6)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                      {fmtDate(dc.challanDate)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                      {dc.vehicleNumber || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                      {dc.driverName || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[12.5px]">
                      {dc.transporterId ? (
                        <EntityPickerChip entity="employee" id={dc.transporterId} />
                      ) : dc.mode ? (
                        <span className="text-zoru-ink-muted">{dc.mode}</span>
                      ) : (
                        <span className="text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {dc.status ? (
                        <StatusPill label={dc.status} tone={statusToTone(dc.status)} />
                      ) : (
                        <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ZoruButton size="sm" variant="ghost" asChild title="Convert to invoice">
                          <Link
                            href={`/dashboard/crm/sales/invoices/new?fromKind=deliveryChallan&fromId=${dc._id}`}
                          >
                            <ArrowRightCircle className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/sales/delivery/${dc._id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(dc)}
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
        </ZoruCard>
      </div>
    </EntityListShell>

    {/* Single delete */}
    <ZoruAlertDialog
      open={pendingDelete !== null}
      onOpenChange={(o) => !o && setPendingDelete(null)}
    >
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete delivery challan?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This permanently removes <strong>{pendingDelete?.challanNumber ?? ''}</strong>{' '}
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

    {/* Bulk delete */}
    <ZoruAlertDialog
      open={pendingBulkDelete}
      onOpenChange={(o) => !o && setPendingBulkDelete(false)}
    >
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete {selected.size} delivery challans?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This permanently removes the selected delivery challans. The
            action cannot be undone.
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

    {busy ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
