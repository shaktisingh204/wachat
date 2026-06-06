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
  Button,
  Card,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
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
 * §1D list client for Delivery Challans upgraded with CrmBulkyGrid
 * and useCrmBulkyState for inline editing and high-density views.
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, Truck } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  deleteDeliveryChallanAction,
  setDeliveryChallanStatus,
} from '@/app/actions/crm-delivery-challans.actions';
import { dateStamp, downloadXlsx } from '@/lib/crm-list-export';
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
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import { fmtDate } from '@/lib/utils';

export type { DcStatus, DcRow, DcKpis };



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
  const [density, setDensity] = React.useState<'comfortable' | 'compact' | 'dense'>('comfortable');

  const filters: DcFilters = {
    query,
    status: initialStatus,
    clientId: initialClientId,
    transporterId: initialTransporterId,
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    warehouseId: initialWarehouseId,
  };

  const bulky = useCrmBulkyState<DcRow>({
    initialData: rows,
    initialPage: page,
    initialLimit: limit,
  });

  React.useEffect(() => {
    bulky.setData(rows);
  }, [rows]);

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
    if (bulky.selected.size === 0) return;
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of bulky.selected) {
        const res = await deleteDeliveryChallanAction(id);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Deleted ${ok}`,
        description: fail > 0 ? `${fail} failed.` : 'All selected removed.',
        variant: fail > 0 ? 'destructive' : undefined,
      });
      bulky.clearSelection();
      setPendingBulkDelete(false);
      router.refresh();
    });
  }

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<DcRow>) => {
    if (!updatedFields.status) return;
    startBusy(async () => {
      try {
        const res = await setDeliveryChallanStatus(id, updatedFields.status as DcStatus);
        if (res.success) {
          toast({ title: 'Saved inline', description: 'Status updated successfully.' });
          bulky.cancelInlineEdit();
          router.refresh();
        } else {
          toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
      }
    });
  };

  function bulkExport() {
    const sel = rows.filter((r) => bulky.selected.has(r._id));
    const csv = dcToCsv(sel);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery-challans-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bulkExportXlsx() {
    const sel = rows.filter((r) => bulky.selected.has(r._id));
    if (sel.length === 0) return;
    const headers = [
      'challan_no',
      'customer_id',
      'so_ref',
      'date',
      'status',
      'vehicle',
      'driver',
      'mode',
    ];
    const exportRows = sel.map((r) => ({
      challan_no: r.challanNumber,
      customer_id: r.accountId,
      so_ref: r.soRef ?? '',
      date: r.challanDate,
      status: r.status,
      vehicle: r.vehicleNumber ?? '',
      driver: r.driverName ?? '',
      mode: r.mode ?? '',
    }));
    void downloadXlsx(
      `delivery-challans-${dateStamp()}.xlsx`,
      headers,
      exportRows,
      'Challans',
    );
  }

  function bulkStatus(next: DcStatus) {
    if (bulky.selected.size === 0) return;
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of bulky.selected) {
        const res = await setDeliveryChallanStatus(id, next);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Updated ${ok}`,
        description: fail > 0 ? `${fail} failed.` : `Status → ${next}.`,
        variant: fail > 0 ? 'destructive' : undefined,
      });
      bulky.clearSelection();
      router.refresh();
    });
  }

  function bulkConvertToInvoice() {
    for (const id of bulky.selected) {
      window.open(
        `/dashboard/crm/sales/invoices/new?fromKind=deliveryChallan&fromId=${id}`,
        '_blank',
      );
    }
  }

  function bulkPrint() {
    const ids = Array.from(bulky.selected).join(',');
    window.open(`/dashboard/crm/sales/delivery/print-bulk?ids=${ids}`, '_blank');
  }

  function bulkManifest() {
    const ids = Array.from(bulky.selected).join(',');
    window.open(`/dashboard/crm/sales/delivery/manifest?ids=${ids}`, '_blank');
  }

  function generateTracking(row: DcRow) {
    const url = `${window.location.origin}/track/${row._id}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Tracking URL copied', description: url });
  }

  const hasActive =
    !!initialStatus ||
    !!initialClientId ||
    !!initialTransporterId ||
    !!initialWarehouseId ||
    !!initialDateFrom ||
    !!initialDateTo;

  const columns = React.useMemo<ColumnDef<DcRow>[]>(() => [
    {
      key: 'challanNumber',
      header: 'Challan #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales/delivery/${row._id}`}
          label={row.challanNumber || '—'}
          subtitle={fmtDate(row.challanDate)}
        />
      ),
    },
    {
      key: 'accountId',
      header: 'Customer',
      sortable: true,
      render: (row) => row.accountId ? (
        <EntityPickerChip entity="client" id={row.accountId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'soRef',
      header: 'SO ref',
      sortable: true,
      render: (row) => row.soRef ? (
        <Link
          href={`/dashboard/crm/sales/orders/${row.soRef}`}
          className="hover:underline text-[12.5px] text-[var(--st-text-secondary)]"
        >
          {row.soRef.slice(-6)}
        </Link>
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'challanDate',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-[12.5px] text-[var(--st-text-secondary)]">
          {fmtDate(row.challanDate)}
        </span>
      ),
    },
    {
      key: 'vehicleNumber',
      header: 'Vehicle #',
      sortable: true,
      render: (row) => (
        <span className="text-[12.5px] text-[var(--st-text)]">
          {row.vehicleNumber || '—'}
        </span>
      ),
    },
    {
      key: 'driverName',
      header: 'Driver',
      sortable: true,
      render: (row) => (
        <span className="text-[12.5px] text-[var(--st-text)]">
          {row.driverName || '—'}
        </span>
      ),
    },
    {
      key: 'allocation',
      header: 'Serial/Batch Allocation',
      render: (row) => {
        const parts = [];
        if (row.batchCount !== undefined && row.batchCount > 0) {
          parts.push(`${row.batchCount} batch${row.batchCount > 1 ? 'es' : ''}`);
        }
        if (row.serialsCount !== undefined && row.serialsCount > 0) {
          parts.push(`${row.serialsCount} serial${row.serialsCount > 1 ? 's' : ''}`);
        }
        if (parts.length === 0) {
          return <span className="text-[12.5px] text-[var(--st-text-secondary)]">—</span>;
        }
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--st-text)] border border-[var(--st-border)]">
            {parts.join(', ')}
          </span>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => row.status ? (
        <StatusPill label={row.status} tone={statusToTone(row.status)} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options: DcStatus[] = ['Draft', 'In Transit', 'Delivered', 'Returned'];
        return (
          <select
            className="h-8 w-28 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] text-[12.5px] p-1 outline-none focus:ring-1 focus:ring-[var(--st-text)]"
            value={value !== undefined ? String(value) : 'Draft'}
            onChange={(e) => onChange(e.target.value as DcStatus)}
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
      key: 'tracking',
      header: 'Tracking',
      render: (row) => row.status === 'In Transit' || row.status === 'Delivered' ? (
        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-[var(--st-text)]" onClick={() => generateTracking(row)}>
          Track Link
        </Button>
      ) : (
        <span className="text-[var(--st-text-secondary)] text-[12.5px]">—</span>
      ),
    },
  ], []);

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
        <Button asChild>
          <Link href="/dashboard/crm/sales/delivery/new">
            <Plus className="h-4 w-4" /> New challan
          </Link>
        </Button>
      }
      bulkBar={
        bulky.selected.size > 0 ? (
          <DcBulkBar
            count={bulky.selected.size}
            onClear={bulky.clearSelection}
            onExport={bulkExport}
            onExportXlsx={bulkExportXlsx}
            onStatus={bulkStatus}
            onConvertToInvoice={bulkConvertToInvoice}
            onPrintBulk={bulkPrint}
            onDispatchManifest={bulkManifest}
            onDelete={() => setPendingBulkDelete(true)}
          />
        ) : null
      }
      empty={
        rows.length === 0 && !initialQuery && !hasActive ? (
          <div className="flex flex-col items-center gap-3 p-4">
            <Truck className="h-8 w-8 text-[var(--st-text-secondary)]" />
            <h3 className="text-base font-medium text-[var(--st-text)]">No delivery challans yet</h3>
            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
              Create a delivery challan to track goods dispatched to customers.
            </p>
            <Button asChild>
              <Link href="/dashboard/crm/sales/delivery/new">
                <Plus className="h-4 w-4" /> New challan
              </Link>
            </Button>
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
          <div className="flex items-center gap-2 rounded border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-4 py-2.5 text-[13px] text-[var(--st-text)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Card className="overflow-hidden p-0">
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

          <div className="p-3 border-b border-[var(--st-border)] flex items-center justify-between gap-4 bg-[var(--st-bg-muted)]">
            <span className="text-[12px] font-medium text-[var(--st-text-secondary)]">
              Double-click a row status to edit inline.
            </span>
            <div className="flex gap-1.5">
              {(['comfortable', 'compact', 'dense'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={density === mode ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] capitalize"
                  onClick={() => setDensity(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          <CrmBulkyGrid<DcRow>
            columns={columns}
            data={bulky.data}
            selectedIds={bulky.selected}
            onSelectOne={bulky.toggleSelectOne}
            onSelectAll={(checked) => bulky.toggleSelectAll(bulky.data.map((r) => r._id), checked)}
            density={density}
            inlineEditRowId={bulky.inlineEditRowId}
            editBuffer={bulky.editBuffer}
            onStartInlineEdit={bulky.startInlineEdit}
            onCancelInlineEdit={bulky.cancelInlineEdit}
            onSaveInlineEdit={handleSaveInlineEdit}
            onUpdateEditBuffer={bulky.updateEditBuffer}
            isLoading={busy}
          />
        </Card>
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
            className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
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
          <ZoruAlertDialogTitle>Delete {bulky.selected.size} delivery challans?</ZoruAlertDialogTitle>
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
            className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
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
