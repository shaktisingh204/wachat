'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { MoreHorizontal } from 'lucide-react';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updatePurchaseOrderStatus } from '@/app/actions/crm/purchase-orders.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import type { PurchaseOrderDensity, PurchaseOrderListRow } from './types';

interface PurchaseOrdersTableProps {
  orders: PurchaseOrderListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  density?: PurchaseOrderDensity;
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

function isDeliveryOverdue(row: PurchaseOrderListRow): boolean {
  if (!row.expectedDelivery) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'received' || s === 'closed' || s === 'cancelled') return false;
  const t = new Date(row.expectedDelivery).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export function PurchaseOrdersTable({
  orders,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: PurchaseOrdersTableProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const bulky = useCrmBulkyState<PurchaseOrderListRow>({
    initialData: orders,
  });

  React.useEffect(() => {
    bulky.setData(orders);
  }, [orders]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<PurchaseOrderListRow>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updatePurchaseOrderStatus(id, updatedFields.status);
      if (res.success) {
        toast({ title: 'Saved inline', description: `Status updated to ${updatedFields.status.replace(/_/g, ' ')}.` });
        bulky.cancelInlineEdit();
        router.refresh();
      } else {
        toast({
          title: 'Update failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const columns = React.useMemo<ColumnDef<PurchaseOrderListRow>[]>(() => [
    {
      key: 'poNo',
      header: 'PO #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/purchases/orders/${row._id}`}
          label={row.poNo || '—'}
          subtitle={row.vendorLabel}
        />
      ),
    },
    {
      key: 'vendorId',
      header: 'Vendor',
      sortable: true,
      render: (row) => row.vendorId ? (
        <EntityPickerChip entity="vendor" id={row.vendorId} />
      ) : (
        <span className="text-zoru-ink-muted">{row.vendorLabel ?? '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">{fmtDate(row.date)}</span>
      ),
    },
    {
      key: 'expectedDelivery',
      header: 'Expected Delivery',
      sortable: true,
      render: (row) => {
        const overdue = isDeliveryOverdue(row);
        const overdueClass = overdue ? 'text-zoru-danger-ink font-semibold' : 'text-zoru-ink-muted';
        return (
          <span className={overdueClass} title={relativeDays(row.expectedDelivery)}>
            {fmtDate(row.expectedDelivery)}
            {overdue && <span className="ml-1 text-[10px] uppercase font-bold">[Overdue]</span>}
          </span>
        );
      },
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-zoru-ink-muted">{row.currency || '—'}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink font-semibold">
          {fmtMoney(row.total, row.currency)}
        </span>
      ),
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
        <span className="text-zoru-ink-muted">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options = ['draft', 'awaiting_approval', 'approved', 'sent', 'partial', 'received', 'closed', 'cancelled'];
        return (
          <select
            className="h-8 w-36 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg text-zoru-ink text-[12.5px] p-1 outline-none focus:ring-1 focus:ring-zoru-primary"
            value={value !== undefined ? String(value) : 'draft'}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'buyerId',
      header: 'Buyer',
      render: (row) => row.buyerId ? (
        <EntityPickerChip entity="user" id={row.buyerId} />
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
    },
    {
      key: 'approverId',
      header: 'Approver',
      render: (row) => row.approverId ? (
        <EntityPickerChip entity="user" id={row.approverId} />
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{fmtDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const id = row._id;
        return (
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Row actions"
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/orders/${id}`}>
                  View Details
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/orders/${id}/edit`}>
                  Edit Order
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/inventory/grn/new?fromKind=purchaseOrder&fromId=${id}`}>
                  Convert to GRN
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/bills/new?fromKind=purchaseOrder&fromId=${id}`}>
                  Convert to Bill
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/orders/${id}/activity`}>
                  Audit Logs / Activity
                </Link>
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  return (
    <CrmBulkyGrid<PurchaseOrderListRow>
      columns={columns}
      data={orders}
      selectedIds={selected}
      onSelectOne={onToggleRow}
      onSelectAll={(checked) => onToggleAll()}
      density={density}
      inlineEditRowId={bulky.inlineEditRowId}
      editBuffer={bulky.editBuffer}
      onStartInlineEdit={bulky.startInlineEdit}
      onCancelInlineEdit={bulky.cancelInlineEdit}
      onSaveInlineEdit={handleSaveInlineEdit}
      onUpdateEditBuffer={bulky.updateEditBuffer}
    />
  );
}
