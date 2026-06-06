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
  Checkbox,
  Input,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  useSearchParams,
  usePathname
} from 'next/navigation';
import {
  AlertCircle,
  ArrowRightCircle,
  LoaderCircle,
  Pencil,
  Trash2,
  Truck,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  deleteSalesOrderAction,
  updateSalesOrder,
  listSalesOrders,
} from '@/app/actions/crm/sales-orders.actions';
import type {
  CrmSalesOrderDoc,
  CrmSalesOrderStatus,
} from '@/lib/rust-client/crm-sales-orders';
import {
  SoActiveFilterChips,
  SoBulkBar,
  SoFiltersBar,
  SoHeadlineKpiStrip,
  SoKpiStrip,
  SoPresetBar,
  soToCsv,
  type SoFilters,
  type SoHeadlineKpis,
  type SoKpis,
  type SoPreset,
} from './sales-orders-list-bits';
import { dateStamp, downloadXlsx } from '@/lib/crm-list-export';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

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
  headlineKpis?: SoHeadlineKpis;
  warehouses?: Array<{ _id: string; name: string }>;
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
  headlineKpis,
  warehouses,
  error,
}: SalesOrdersListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus || 'all');
  const [pendingDelete, setPendingDelete] = React.useState<CrmSalesOrderDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [density, setDensity] = React.useState<'comfortable' | 'compact' | 'dense'>('comfortable');

  const filters: SoFilters = {
    query,
    status: statusFilter === 'all' ? '' : statusFilter,
    clientId: initialClientId,
    agentId: initialAgentId,
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
    shipFrom: initialShipFrom,
    shipTo: initialShipTo,
  };

  const pushParams = React.useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, pathname, router]);

  const bulky = useCrmBulkyState<CrmSalesOrderDoc>({
    initialData: orders,
    initialPage: page,
    initialLimit: limit,
    fetchFn: async ({ page: p, limit: l, search, filters: f }) => {
      const res = await listSalesOrders({
        page: p,
        limit: l,
        q: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as CrmSalesOrderStatus) : undefined,
        clientId: initialClientId || undefined,
      });
      return {
        items: res.orders,
        total: res.orders.length,
        hasMore: res.hasMore,
      };
    },
  });

  // Re-sync local grid when server inputs change
  React.useEffect(() => {
    bulky.setData(orders);
  }, [orders]);

  React.useEffect(() => {
    bulky.triggerFetch();
  }, [bulky.page, bulky.limit, statusFilter]);

  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      pushParams({ q: query.trim() || undefined, page: '1' });
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, pushParams]);

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

  function confirmDelete() {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.soNo || id;
    bulky.runBulkOperation(async () => {
      const res = await deleteSalesOrderAction(id);
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

  function confirmBulkDelete() {
    if (bulky.selected.size === 0) return;
    bulky.runBulkOperation(async (ids) => {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        const res = await deleteSalesOrderAction(id);
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

  function bulkStatus(next: CrmSalesOrderStatus) {
    if (bulky.selected.size === 0) return;
    bulky.runBulkOperation(async (ids) => {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
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
      router.refresh();
      return { success: fail === 0 };
    });
  }

  function bulkExport() {
    const rows = bulky.data.filter((o) => bulky.selected.size === 0 || bulky.selected.has(String(o._id)));
    const csv = soToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bulkExportXlsx() {
    const rows = bulky.data.filter((o) => bulky.selected.size === 0 || bulky.selected.has(String(o._id)));
    if (rows.length === 0) return;
    const headers = [
      'so_no',
      'date',
      'expected_shipment',
      'customer_id',
      'po_no',
      'quotation_ref',
      'status',
      'currency',
      'total',
    ];
    const exportRows = rows.map((r) => ({
      so_no: r.soNo ?? '',
      date: r.date ?? '',
      expected_shipment: r.expectedShipmentDate ?? '',
      customer_id: r.clientId ?? '',
      po_no: r.poNo ?? '',
      quotation_ref: r.quotationRef ?? '',
      status: r.status ?? '',
      currency: r.currency ?? '',
      total: r.totals?.total ?? '',
    }));
    void downloadXlsx(
      `sales-orders-${dateStamp()}.xlsx`,
      headers,
      exportRows,
      'Orders',
    );
  }

  function bulkConvertToDc() {
    for (const id of bulky.selected) {
      window.open(
        `/dashboard/crm/sales/delivery/new?fromKind=salesOrder&fromId=${id}`,
        '_blank',
      );
    }
  }

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmSalesOrderDoc>) => {
    try {
      const res = await updateSalesOrder(id, updatedFields);
      if (res) {
        toast({ title: 'Saved inline', description: 'Sales order updated successfully.' });
        bulky.cancelInlineEdit();
        bulky.triggerFetch();
        router.refresh();
      } else {
        toast({ title: 'Update failed', description: 'Update did not return a value', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    !!initialClientId ||
    !!initialAgentId ||
    !!initialDateFrom ||
    !!initialDateTo ||
    !!initialShipFrom ||
    !!initialShipTo;

  const columns = React.useMemo<ColumnDef<CrmSalesOrderDoc>[]>(() => [
    {
      key: 'soNo',
      header: 'SO #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales/orders/${row._id}`}
          label={row.soNo || '—'}
          subtitle={row.poNo ? `PO ${row.poNo}` : fmtDate(row.date)}
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
      key: 'clientId',
      header: 'Customer',
      render: (row) => row.clientId ? (
        <EntityPickerChip entity="client" id={row.clientId} />
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{fmtDate(row.date)}</span>,
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
      key: 'expectedShipmentDate',
      header: 'Expected shipment',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{fmtDate(row.expectedShipmentDate)}</span>,
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
      key: 'warehouseAllocation',
      header: 'Warehouse Allocation',
      render: (row) => {
        const whIds = Array.from(new Set(row.items?.map(it => it.warehouseId).filter(Boolean)));
        if (whIds.length === 0) return <span className="text-zoru-ink-muted">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {whIds.map((id) => {
              const whName = warehouses?.find(w => String(w._id) === id)?.name || `WH-${id?.slice(-4)}`;
              return (
                <span key={id} className="inline-flex items-center rounded-full bg-zoru-surface-2 border border-zoru-line px-1.5 py-0.5 text-[10.5px] font-medium text-zoru-ink">
                  {whName}
                </span>
              );
            })}
          </div>
        );
      }
    },
    {
      key: 'quotationRef',
      header: 'Quotation ref',
      render: (row) => row.quotationRef ? (
        <Link
          href={`/dashboard/crm/sales/quotations/${row.quotationRef}`}
          className="hover:underline text-[12.5px]"
        >
          {row.quotationRef.slice(-6)}
        </Link>
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
    },
    {
      key: 'poNo',
      header: 'PO #',
      render: (row) => <span className="text-zoru-ink-muted">{row.poNo || '—'}</span>,
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-28 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink font-semibold">
          {fmtMoney(row.totals?.total, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => row.status ? (
        <StatusPill
          label={row.status}
          tone={statusToTone(row.status)}
        />
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options = ['open', 'partial', 'fulfilled', 'closed', 'cancelled'];
        return (
          <select
            className="h-8 w-28 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg text-zoru-ink text-[12.5px] p-1 outline-none"
            value={value !== undefined ? String(value) : 'open'}
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
      key: 'assignedTo',
      header: 'Sales agent',
      render: (row) => {
        const agentId = row.assignment?.assignedTo;
        return agentId ? (
          <EntityPickerChip entity="user" id={agentId} />
        ) : (
          <span className="text-zoru-ink-muted">—</span>
        );
      }
    }
  ], [warehouses]);

  return (
    <div className="flex flex-col gap-4">
      {headlineKpis ? <SoHeadlineKpiStrip kpis={headlineKpis} /> : null}

      <SoKpiStrip
        kpis={kpis}
        currentStatus={statusFilter}
        onClick={(s) => {
          const next = statusFilter === s ? 'all' : s;
          setStatusFilter(next);
          pushParams({ status: next !== 'all' ? next : undefined, page: '1' });
        }}
      />

      <SoPresetBar
        onPreset={(p) => {
          setStatusFilter(p.params.status || 'all');
          applyPreset(p);
        }}
        hasActive={hasActiveFilters}
        onClear={() => {
          setStatusFilter('all');
          clearAllFilters();
        }}
      />

      <Card className="overflow-hidden p-0">
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
          <div className="flex items-center gap-2 border-b border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <SoBulkBar
          count={bulky.selected.size}
          onClear={bulky.clearSelection}
          onStatus={bulkStatus}
          onExport={bulkExport}
          onExportXlsx={bulkExportXlsx}
          onConvertToDc={bulkConvertToDc}
          onArchive={() => bulkStatus('closed')}
          onDelete={() => setPendingBulkDelete(true)}
        />

        <div className="flex items-center justify-between px-4 py-2 border-b border-zoru-line bg-zoru-surface-2/20">
          <div className="text-[12.5px] text-zoru-ink-muted">
            Double-click any row to edit inline or use the actions menu
          </div>
          <div className="flex items-center border border-zoru-line rounded-md p-0.5 bg-zoru-surface-2/40">
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
        </div>

        <CrmBulkyGrid<CrmSalesOrderDoc>
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

        <PaginationBar page={bulky.page} limit={bulky.limit} hasMore={hasMore} />

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
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
                className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
              >
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
              <ZoruAlertDialogTitle>Delete {bulky.selected.size} sales orders?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                This permanently removes the selected sales orders. The action
                cannot be undone.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmBulkDelete();
                }}
                className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
              >
                Delete permanently
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>
      </Card>
    </div>
  );
}
