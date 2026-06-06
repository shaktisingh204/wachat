'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Payouts — list page (client island) upgraded with spreadsheet-style CrmBulkyGrid.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

import {
  deletePayout,
  getPayouts,
  updatePayoutStatus,
} from '@/app/actions/crm-payouts-v2.actions';
import type {
  CrmPayoutDoc,
  CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';

const BASE = '/dashboard/crm/purchases/payouts';

const STATUS_TONE: Record<CrmPayoutStatus, StatusTone> = {
  sent: 'blue',
  cleared: 'green',
  failed: 'red',
};

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(amount: number | undefined, currency: string | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `${currency ?? ''} ${amount.toFixed(2)}`.trim();
}

export function PayoutsListPage() {
  const { toast } = useToast();
  const [payouts, setPayouts] = React.useState<CrmPayoutDoc[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmPayoutStatus | 'all'>('all');
  const [pendingDelete, setPendingDelete] = React.useState<CrmPayoutDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();

  const bulky = useCrmBulkyState<CrmPayoutDoc>({
    initialData: payouts,
  });

  const filtered = bulky.data;

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getPayouts({
        q: search.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      });
      setPayouts(res.items ?? []);
    } catch {
      setPayouts([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  React.useEffect(() => {
    bulky.setData(payouts);
  }, [payouts]);

  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deletePayout(id);
      if (result.success) {
        toast({ title: 'Payout deleted' });
        setPendingDelete(null);
        bulky.toggleSelectOne(id);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not delete payout.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmPayoutDoc>) => {
    if (!updatedFields.status) return;
    try {
      const res = await updatePayoutStatus(id, updatedFields.status as CrmPayoutStatus);
      if (res.success) {
        toast({
          title: 'Saved inline',
          description: `Payout status updated to ${updatedFields.status}.`,
        });
        bulky.setData((prev) =>
          prev.map((row) => (row._id === id ? { ...row, ...updatedFields } : row))
        );
        bulky.cancelInlineEdit();
        await refresh();
      } else {
        toast({
          title: 'Update failed',
          description: res.error || 'Unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const columns = React.useMemo<ColumnDef<CrmPayoutDoc>[]>(() => [
    {
      key: 'paymentNo',
      header: 'Payout no.',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`${BASE}/${row._id}`}
          label={<span className="font-mono">{row.paymentNo}</span>}
          subtitle={row.vendorId || undefined}
        />
      ),
    },
    {
      key: 'vendorId',
      header: 'Vendor',
      sortable: true,
      render: (row) => <span className="font-mono text-[12px] text-[var(--st-text)]">{row.vendorId}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text)]">{fmtMoney(row.amount, row.currency)}</span>,
    },
    {
      key: 'mode',
      header: 'Method',
      sortable: true,
      render: (row) => <span className="uppercase text-[12px] text-[var(--st-text)]">{row.mode}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-[var(--st-text)]">{fmtDate(row.date)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        const status = (row.status ?? 'sent') as CrmPayoutStatus;
        const tone = STATUS_TONE[status] ?? 'neutral';
        return <StatusPill label={status} tone={tone} />;
      },
      editRender: (row, value, onChange) => (
        <select
          className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded px-1.5 py-0.5 text-xs text-[var(--st-text)] focus:outline-none"
          value={value || 'sent'}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="sent">Sent</option>
          <option value="cleared">Cleared</option>
          <option value="failed">Failed</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${BASE}/${row._id}/edit`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPendingDelete(row)}
          >
            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <>
      <EntityListShell
        title="Payouts"
        subtitle="Outgoing vendor payments — cash, cheque, UPI, NEFT, etc."
        primaryAction={
          <Button asChild>
            <Link href={`${BASE}/new`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New payout
            </Link>
          </Button>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search payouts…',
        }}
        filters={
          <EnumFilterField
            enumName="payoutStatus"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as CrmPayoutStatus | 'all')}
            placeholder="All statuses"
          />
        }
        bulkBar={
          bulky.selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-[var(--st-text)]">
                {bulky.selected.size} selected
              </span>
              <span className="text-[var(--st-text-secondary)]">·</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={bulky.clearSelection}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : null
        }
        loading={isLoading && payouts.length === 0}
      >
        <div className="overflow-hidden rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          <CrmBulkyGrid<CrmPayoutDoc>
            columns={columns}
            data={filtered}
            selectedIds={bulky.selected}
            onSelectOne={(id) => bulky.toggleSelectOne(id)}
            onSelectAll={(checked) =>
              bulky.toggleSelectAll(
                filtered.map((d) => String(d._id)),
                checked
              )
            }
            density="comfortable"
            inlineEditRowId={bulky.inlineEditRowId}
            editBuffer={bulky.editBuffer}
            onStartInlineEdit={bulky.startInlineEdit}
            onCancelInlineEdit={bulky.cancelInlineEdit}
            onSaveInlineEdit={handleSaveInlineEdit}
            onUpdateEditBuffer={bulky.updateEditBuffer}
            isLoading={isLoading}
          />
        </div>
      </EntityListShell>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payout?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this payout will remove it from the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
