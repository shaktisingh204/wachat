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
import { updateBillStatus } from '@/app/actions/crm/bills.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import type { BillDensity, BillListRow } from './types';

interface BillsTableProps {
  bills: BillListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelectedOnPage: boolean;
  filtersActive: boolean;
  density?: BillDensity;
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

function isOverdue(row: BillListRow): boolean {
  if (!row.dueDate) return false;
  const s = (row.status ?? '').toLowerCase();
  if (s === 'paid' || s === 'cancelled') return false;
  const t = new Date(row.dueDate).getTime();
  return !Number.isNaN(t) && t < Date.now() && (row.balance ?? 0) > 0;
}

export function BillsTable({
  bills,
  selected,
  onToggleRow,
  onToggleAll,
  allSelectedOnPage,
  filtersActive,
  density = 'comfortable',
}: BillsTableProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  const bulky = useCrmBulkyState<BillListRow>({
    initialData: bills,
  });

  React.useEffect(() => {
    bulky.setData(bills);
  }, [bills]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<BillListRow>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updateBillStatus(id, updatedFields.status);
      if (res.success) {
        toast({ title: 'Saved inline', description: `Bill status updated to ${updatedFields.status.replace(/_/g, ' ')}.` });
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

  const columns = React.useMemo<ColumnDef<BillListRow>[]>(() => [
    {
      key: 'billNo',
      header: 'Bill #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/purchases/expenses/${row._id}`}
          label={row.billNo || '—'}
          subtitle={row.vendorLabel || row.vendorInvoiceNo || undefined}
        />
      ),
    },
    {
      key: 'vendorInvoiceNo',
      header: 'Vendor Invoice #',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{row.vendorInvoiceNo || '—'}</span>,
    },
    {
      key: 'vendorId',
      header: 'Vendor',
      sortable: true,
      render: (row) => row.vendorId ? (
        <EntityPickerChip entity="vendor" id={row.vendorId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">{row.vendorLabel ?? '—'}</span>
      ),
    },
    {
      key: 'billDate',
      header: 'Bill Date',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text-secondary)]">{fmtDate(row.billDate)}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (row) => {
        const overdue = isOverdue(row);
        const overdueClass = overdue ? 'text-[var(--st-danger)] font-semibold' : 'text-[var(--st-text-secondary)]';
        return (
          <span className={overdueClass} title={relativeDays(row.dueDate)}>
            {fmtDate(row.dueDate)}
            {overdue && <span className="ml-1 text-[10px] uppercase font-bold">[Overdue]</span>}
          </span>
        );
      },
    },
    {
      key: 'currency',
      header: 'Currency',
      render: (row) => <span className="text-[var(--st-text-secondary)]">{row.currency || '—'}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text)] font-semibold">
          {fmtMoney(row.total, row.currency)}
        </span>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-[var(--st-text-secondary)]">
          {fmtMoney(row.paid, row.currency)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortable: true,
      render: (row) => {
        const overdue = isOverdue(row);
        const colorClass = overdue && row.balance > 0 ? 'text-[var(--st-danger)] font-semibold' : 'text-[var(--st-text)]';
        return (
          <span className={`font-mono tabular-nums ${colorClass}`}>
            {fmtMoney(row.balance, row.currency)}
          </span>
        );
      },
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
        const options = ['draft', 'unpaid', 'partially_paid', 'paid', 'void', 'cancelled'];
        return (
          <select
            className="h-8 w-36 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] text-[12.5px] p-1 outline-none focus:ring-1 focus:ring-[var(--st-text)]"
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
      key: 'linkedPo',
      header: 'Linked PO',
      render: (row) => row.linkedPoId ? (
        <Link
          href={`/dashboard/crm/purchases/orders/${row.linkedPoId}`}
          className="text-[var(--st-text)] hover:underline font-semibold"
        >
          PO
        </Link>
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
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
                <Link href={`/dashboard/crm/purchases/expenses/${id}`}>
                  View Details
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/expenses/${id}/edit`}>
                  Edit Bill
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/payouts/new?fromKind=bill&fromId=${id}`}>
                  Record Payout
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/debit-notes/new?fromKind=bill&fromId=${id}`}>
                  Record Debit Note
                </Link>
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/expenses/${id}/activity`}>
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
    <CrmBulkyGrid<BillListRow>
      columns={columns}
      data={bills}
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
