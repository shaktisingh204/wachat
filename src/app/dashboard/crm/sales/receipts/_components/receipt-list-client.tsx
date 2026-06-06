'use client';

import { Badge, Button, Card, useToast } from '@/components/sabcrm/20ui/compat';
import { Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Payment receipts table upgraded to use spreadsheet-style CrmBulkyGrid
 * and useCrmBulkyState. Supports double-click status edits and custom row density.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setPaymentReceiptStatus } from '@/app/actions/crm/payment-receipts.actions';
import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

export type ReceiptListPreset = 'all' | 'this_month' | 'bounced' | 'pending_clearance';

interface ReceiptListClientProps {
  receipts: CrmPaymentReceiptDoc[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  onDelete: (id: string) => void;
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
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function modeLabel(mode: string | undefined): string {
  if (!mode) return '—';
  const map: Record<string, string> = {
    cash: 'Cash',
    cheque: 'Cheque',
    upi: 'UPI',
    neft: 'NEFT',
    rtgs: 'RTGS',
    imps: 'IMPS',
    card: 'Card',
    wallet: 'Wallet',
  };
  return map[mode] ?? mode;
}

export function ReceiptListClient({
  receipts,
  loading,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onDelete,
}: ReceiptListClientProps) {
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [density, setDensity] = React.useState<'comfortable' | 'compact' | 'dense'>('comfortable');

  const bulky = useCrmBulkyState<CrmPaymentReceiptDoc>({
    initialData: receipts,
  });

  React.useEffect(() => {
    bulky.setData(receipts);
  }, [receipts]);

  // Sync selection state with the parent page's selection state
  React.useEffect(() => {
    bulky.setSelected(selectedIds);
  }, [selectedIds, bulky]);

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmPaymentReceiptDoc>) => {
    if (!updatedFields.status) return;
    setBusyId(id);
    try {
      const res = await setPaymentReceiptStatus(id, updatedFields.status as 'cleared' | 'bounced');
      setBusyId(null);
      if (res.success) {
        toast({ title: 'Saved inline', description: `Status set to ${updatedFields.status}.` });
        bulky.cancelInlineEdit();
        // Since parent controls state, we let the parent refresh data.
      } else {
        toast({
          title: 'Update failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setBusyId(null);
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const columns = React.useMemo<ColumnDef<CrmPaymentReceiptDoc>[]>(() => [
    {
      key: 'receiptNo',
      header: 'Receipt #',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales/receipts/${row._id}`}
          label={row.receiptNo || String(row._id).slice(-6)}
          subtitle={fmtDate(row.date)}
        />
      ),
    },
    {
      key: 'clientId',
      header: 'Customer',
      sortable: true,
      render: (row) => row.clientId ? (
        <EntityPickerChip entity="client" id={row.clientId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-[12.5px] text-[var(--st-text-secondary)]">
          {fmtDate(row.date)}
        </span>
      ),
    },
    {
      key: 'mode',
      header: 'Mode',
      sortable: true,
      render: (row) => (
        <Badge variant="outline" className="capitalize text-[11px]">
          {modeLabel(row.mode)}
        </Badge>
      ),
    },
    {
      key: 'bankAccountId',
      header: 'Bank',
      sortable: true,
      render: (row) => row.bankAccountId ? (
        <EntityPickerChip entity="bankAccount" id={row.bankAccountId} />
      ) : (
        <span className="text-[var(--st-text-secondary)]">—</span>
      ),
    },
    {
      key: 'reference',
      header: 'Cheque / Ref',
      render: (row) => (
        <span className="text-[12.5px] text-[var(--st-text-secondary)]">
          {row.chequeNo || row.txnId || row.reference || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => (
        <span className="text-[12.5px] font-mono font-semibold tabular-nums text-[var(--st-text)]">
          {fmtMoney(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        const lbl = row.status || 'received';
        return <StatusPill label={lbl} tone={statusToTone(lbl)} />;
      },
      editRender: (row, value, onChange) => {
        const options = ['received', 'cleared', 'bounced'];
        return (
          <select
            className="h-8 w-28 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] text-[12.5px] p-1 outline-none focus:ring-1 focus:ring-[var(--st-text)]"
            value={value !== undefined ? String(value) : 'received'}
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
      key: 'appliedCount',
      header: 'Applied Invoices',
      render: (row) => {
        const count = row.applyTo?.length ?? 0;
        if (count === 0) return <span className="text-[12.5px] text-[var(--st-text-secondary)]">—</span>;
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11px] font-bold text-[var(--st-text)] border border-[var(--st-border)]">
            {count} invoice{count > 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const id = String(row._id);
        return (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/dashboard/crm/sales/receipts/${id}/edit`}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(id)}
              className="text-[var(--st-danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ], [onDelete]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-3 border-b border-[var(--st-border)] flex items-center justify-between gap-4 bg-[var(--st-bg-muted)]">
        <span className="text-[12px] font-medium text-[var(--st-text-secondary)]">
          Double-click status to edit inline.
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

      <CrmBulkyGrid<CrmPaymentReceiptDoc>
        columns={columns}
        data={bulky.data}
        selectedIds={bulky.selected}
        onSelectOne={onToggleOne}
        onSelectAll={(checked) => onToggleAll(checked)}
        density={density}
        inlineEditRowId={bulky.inlineEditRowId}
        editBuffer={bulky.editBuffer}
        onStartInlineEdit={bulky.startInlineEdit}
        onCancelInlineEdit={bulky.cancelInlineEdit}
        onSaveInlineEdit={handleSaveInlineEdit}
        onUpdateEditBuffer={bulky.updateEditBuffer}
        isLoading={loading || busyId !== null}
      />
    </Card>
  );
}
