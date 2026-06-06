'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
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
import { updateRfqStatus } from '@/app/actions/crm/rfqs.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import type { RfqListRow } from './types';

type DensityMode = 'comfortable' | 'compact' | 'dense';

interface RfqTableProps {
  rfqs: RfqListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  defaultCurrency: string;
  density?: DensityMode;
}

import { fmtINR, fmtDate } from '@/lib/utils';


export function RfqTable({
  rfqs,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  defaultCurrency,
  density = 'comfortable',
}: RfqTableProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const bulky = useCrmBulkyState<RfqListRow>({
    initialData: rfqs,
  });

  React.useEffect(() => {
    bulky.setData(rfqs);
  }, [rfqs]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<RfqListRow>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updateRfqStatus(id, updatedFields.status);
      if (res.success) {
        toast({ title: 'Saved inline', description: `RFQ status updated to ${updatedFields.status.replace(/_/g, ' ')}.` });
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

  const columns = React.useMemo<ColumnDef<RfqListRow>[]>(() => [
    {
      key: 'title',
      header: 'RFQ',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/purchases/rfqs/${row._id}`}
          label={row.title || '—'}
          subtitle={row.vendorsInvitedCount ? `${row.vendorsInvitedCount} vendor${row.vendorsInvitedCount === 1 ? '' : 's'} invited` : undefined}
        />
      ),
    },
    {
      key: 'scope',
      header: 'Scope / Title',
      sortable: true,
      render: (row) => <span className="text-zoru-ink-muted">{row.scope || row.title || '—'}</span>,
    },
    {
      key: 'vendorsInvitedCount',
      header: 'Vendors',
      render: (row) => (
        <Badge variant="outline" className="text-[11px] font-bold">
          {row.vendorsInvitedCount}
        </Badge>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      sortable: true,
      render: (row) => {
        const isPast = row.deadlinePassed;
        const colorClass = isPast ? 'text-zoru-danger-ink font-semibold' : 'text-zoru-ink-muted';
        return (
          <span className={colorClass}>
            {fmtDate(row.deadline)}
            {isPast && <span className="ml-1 text-[10.5px] uppercase font-bold">[Past]</span>}
          </span>
        );
      },
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-zoru-ink-muted">{row.currency || defaultCurrency}</span>,
    },
    {
      key: 'estimatedValue',
      header: 'Est. Value',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink font-semibold">
          {fmtINR(row.estimatedValue, row.currency ?? defaultCurrency)}
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
        const options = ['draft', 'sent', 'closed', 'awarded', 'cancelled'];
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
      key: 'ownerId',
      header: 'Owner',
      render: (row) => row.ownerId ? (
        <EntityPickerChip entity="user" id={row.ownerId} />
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
                <Link href={`/dashboard/crm/purchases/rfqs/${id}`}>
                  View Details
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/rfqs/${id}/edit`}>
                  Edit RFQ
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/vendor-bids/new?fromKind=rfq&fromId=${id}`}>
                  Record Bid
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/rfqs/${id}/activity`}>
                  Audit Logs / Activity
                </Link>
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [defaultCurrency]);

  return (
    <CrmBulkyGrid<RfqListRow>
      columns={columns}
      data={rfqs}
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
