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
} from '@/components/zoruui';
import { MoreHorizontal } from 'lucide-react';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updateVendorBidStatus } from '@/app/actions/crm/vendor-bids.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import type { VendorBidListRow } from './types';

type DensityMode = 'comfortable' | 'compact' | 'dense';

interface VendorBidTableProps {
  bids: VendorBidListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  defaultCurrency: string;
  density?: DensityMode;
}

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
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

export function VendorBidTable({
  bids,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  defaultCurrency,
  density = 'comfortable',
}: VendorBidTableProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const bulky = useCrmBulkyState<VendorBidListRow>({
    initialData: bids,
  });

  React.useEffect(() => {
    bulky.setData(bids);
  }, [bids]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<VendorBidListRow>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updateVendorBidStatus(id, updatedFields.status);
      if (res.success) {
        toast({ title: 'Saved inline', description: `Bid status updated to ${updatedFields.status.replace(/_/g, ' ')}.` });
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

  const columns = React.useMemo<ColumnDef<VendorBidListRow>[]>(() => [
    {
      key: 'bidNo',
      header: 'Bid #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/purchases/vendor-bids/${row._id}`}
          label={row.bidNo}
          subtitle={row.vendorName || undefined}
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
        <span className="text-zoru-ink-muted">{row.vendorName || '—'}</span>
      ),
    },
    {
      key: 'rfqId',
      header: 'Linked RFQ',
      render: (row) => row.rfqId ? (
        <Link
          href={`/dashboard/crm/purchases/rfqs/${row.rfqId}`}
          className="font-mono text-[11.5px] text-zoru-ink-muted hover:underline font-semibold"
        >
          {row.rfqId.slice(-8).toUpperCase()}
        </Link>
      ) : (
        <span className="text-zoru-ink-muted">—</span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{fmtDate(row.submittedAt)}</span>,
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-zoru-ink-muted">{row.currency || defaultCurrency}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink font-semibold">
          {fmtMoney(row.total, row.currency ?? defaultCurrency)}
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Budget vs Price',
      render: (row) => {
        if (row.budget == null || row.total == null) return <span className="text-zoru-ink-muted">—</span>;
        const variance = row.budget - row.total;
        const variancePct = (variance / row.budget) * 100;
        const isOver = variance < 0;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[12px] tabular-nums text-zoru-ink-muted line-through">
              {fmtMoney(row.budget, row.currency ?? defaultCurrency)}
            </span>
            <span className={`text-[10px] font-medium ${isOver ? 'text-zoru-danger-ink' : 'text-zoru-success-ink'}`}>
              {isOver ? '+' : '-'}{Math.abs(variancePct).toFixed(1)}% {isOver ? 'over' : 'under'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'leadTimeDays',
      header: 'Lead (days)',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted tabular-nums">
          {typeof row.leadTimeDays === 'number' ? row.leadTimeDays : '—'}
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
        const options = ['draft', 'submitted', 'under_review', 'awarded', 'declined', 'cancelled'];
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
                <Link href={`/dashboard/crm/purchases/vendor-bids/${id}`}>
                  View Details
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/vendor-bids/${id}/edit`}>
                  Edit Bid
                </Link>
              </ZoruDropdownMenuItem>
              {row.status === 'awarded' && (
                <ZoruDropdownMenuItem asChild>
                  <Link href={`/dashboard/crm/purchases/orders/new?fromKind=vendorBid&fromId=${id}`}>
                    Convert to PO
                  </Link>
                </ZoruDropdownMenuItem>
              )}
              {row.status !== 'awarded' && row.status !== 'rejected' && (
                <>
                  <ZoruDropdownMenuSeparator />
                  <ZoruDropdownMenuItem onSelect={() => handleSaveInlineEdit(id, { status: 'awarded' })}>
                    Approve (Award)
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onSelect={() => handleSaveInlineEdit(id, { status: 'rejected' })}>
                    Reject
                  </ZoruDropdownMenuItem>
                </>
              )}
              {row.rfqId && (
                <>
                  <ZoruDropdownMenuSeparator />
                  <ZoruDropdownMenuItem asChild>
                    <Link href={`/dashboard/crm/purchases/rfqs/${row.rfqId}`}>
                      Open Linked RFQ
                    </Link>
                  </ZoruDropdownMenuItem>
                </>
              )}
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [defaultCurrency]);

  return (
    <CrmBulkyGrid<VendorBidListRow>
      columns={columns}
      data={bids}
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
