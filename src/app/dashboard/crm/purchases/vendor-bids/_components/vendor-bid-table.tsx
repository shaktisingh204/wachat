'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useToast } from '@/components/sabcrm/20ui';
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

import { fmtINR, fmtDate } from '@/lib/utils';


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
  const { toast } = useToast();
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
        <span className="text-[var(--st-text-secondary)]">{row.vendorName || '—'}</span>
      ),
    },
    {
      key: 'rfqId',
      header: 'Linked RFQ',
      render: (row) => row.rfqId ? (
        <Link
          href={`/dashboard/crm/purchases/rfqs/${row.rfqId}`}
          className="font-mono text-[11.5px] text-[var(--st-text-secondary)] hover:underline font-semibold"
        >
          {row.rfqId.slice(-8).toUpperCase()}
        </Link>
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{fmtDate(row.submittedAt)}</span>,
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-[var(--st-text-secondary)]">{row.currency || defaultCurrency}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text)] font-semibold">
          {fmtINR(row.total, row.currency ?? defaultCurrency)}
        </span>
      ),
    },
    {
      key: 'budget',
      header: 'Budget vs Price',
      render: (row) => {
        if (row.budget == null || row.total == null) return <span className="text-[var(--st-text-secondary)]">—</span>;
        const variance = row.budget - row.total;
        const variancePct = (variance / row.budget) * 100;
        const isOver = variance < 0;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[12px] tabular-nums text-[var(--st-text-secondary)] line-through">
              {fmtINR(row.budget, row.currency ?? defaultCurrency)}
            </span>
            <span className={`text-[10px] font-medium ${isOver ? 'text-[var(--st-danger)]' : 'text-[var(--st-status-ok)]'}`}>
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
        <span className="text-[var(--st-text-secondary)] tabular-nums">
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
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
      editRender: (row, value, onChange) => {
        const options = ['draft', 'submitted', 'under_review', 'awarded', 'declined', 'cancelled'];
        return (
          <select
            className="h-8 w-36 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] text-[12.5px] p-1 outline-none focus:ring-1 focus:ring-[var(--st-text)]"
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
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Row actions"
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/vendor-bids/${id}`}>
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/vendor-bids/${id}/edit`}>
                  Edit Bid
                </Link>
              </DropdownMenuItem>
              {row.status === 'awarded' && (
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/crm/purchases/orders/new?fromKind=vendorBid&fromId=${id}`}>
                    Convert to PO
                  </Link>
                </DropdownMenuItem>
              )}
              {row.status !== 'awarded' && row.status !== 'rejected' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handleSaveInlineEdit(id, { status: 'awarded' })}>
                    Approve (Award)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleSaveInlineEdit(id, { status: 'rejected' })}>
                    Reject
                  </DropdownMenuItem>
                </>
              )}
              {row.rfqId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/crm/purchases/rfqs/${row.rfqId}`}>
                      Open Linked RFQ
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
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
