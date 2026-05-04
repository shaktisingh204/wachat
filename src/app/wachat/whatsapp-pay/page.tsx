'use client';

/**
 * Wachat WhatsApp Pay — Transactions tab (ZoruUI).
 *
 * KPI strip + transaction chart + transaction table with refund-confirm
 * alert dialog.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { subDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Papa from 'papaparse';
import {
  IndianRupee,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  MoreHorizontal,
  Receipt,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { getProjectById } from '@/app/actions/index';
import { getTransactionsForProject } from '@/app/actions/whatsapp.actions';
import type { Project, Transaction } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { TransactionChart } from '@/app/wachat/_components/transaction-chart';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDataTable,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  description: string;
  date: string;
};

function statusVariant(
  status?: string,
): 'success' | 'danger' | 'ghost' | 'warning' | 'secondary' {
  if (!status) return 'secondary';
  const s = status.toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'captured') return 'success';
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return 'danger';
  if (s === 'pending' || s === 'created') return 'warning';
  return 'ghost';
}

/* ── Stat card ────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <ZoruCard className="flex items-start gap-4 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-zoru-ink-muted">{label}</p>
        {loading ? (
          <ZoruSkeleton className="mt-1 h-7 w-24" />
        ) : (
          <p className="text-[22px] tabular-nums text-zoru-ink leading-tight">
            {value}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-zoru-ink-muted">{hint}</p>
      </div>
    </ZoruCard>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function WhatsAppPayPage() {
  const { activeProject } = useProject();
  const [, setProject] = useState<WithId<Project> | null>(null);
  const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useZoruToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null);
  const [refundPending, startRefundTransition] = useTransition();

  const activeProjectId = activeProject?._id?.toString() ?? null;

  const fetchData = useCallback(
    async (showToast = false) => {
      if (!activeProjectId) return;
      startLoading(async () => {
        const [projectData, transactionsData] = await Promise.all([
          getProjectById(activeProjectId),
          getTransactionsForProject(activeProjectId),
        ]);
        setProject(projectData);
        setTransactions(transactionsData);
        if (showToast) {
          toast({ title: 'Refreshed', description: 'Payment data updated.' });
        }
      });
    },
    [activeProjectId, toast],
  );

  useEffect(() => {
    if (activeProjectId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const stats = useMemo(
    () =>
      transactions.reduce(
        (acc, t) => {
          if (t.status === 'SUCCESS') {
            acc.successfulTransactions++;
            acc.totalRevenue += t.amount / 100;
          }
          return acc;
        },
        { successfulTransactions: 0, totalRevenue: 0 },
      ),
    [transactions],
  );

  const handleExport = () => {
    if (!transactions.length) return;
    const csv = Papa.unparse(
      transactions.map((t) => ({
        ID: t._id,
        Date: new Date(t.createdAt).toLocaleString(),
        Description: t.description,
        Amount: t.amount / 100,
        Status: t.status,
        ProjectID: activeProjectId,
      })),
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const tableData: PaymentRow[] = useMemo(
    () =>
      transactions.map((t) => ({
        id: t._id.toString(),
        amount: t.amount,
        status: t.status,
        description: t.description,
        date: t.createdAt.toString(),
      })),
    [transactions],
  );

  const columns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-[12px] text-zoru-ink-muted">
            {format(new Date(row.original.date), 'PPp')}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-zoru-ink">{row.original.description}</span>
        ),
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
          const formatted = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
          }).format(row.original.amount / 100);
          return (
            <div className="text-right tabular-nums text-zoru-ink">
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <ZoruBadge
            variant={statusVariant(row.original.status)}
            className="capitalize"
          >
            {row.original.status.toLowerCase()}
          </ZoruBadge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <ZoruButton
                variant="ghost"
                size="icon-sm"
                aria-label="Open actions menu"
              >
                <MoreHorizontal />
              </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem
                onSelect={() => {
                  navigator.clipboard.writeText(row.original.id);
                  toast({
                    title: 'Copied',
                    description: 'Transaction ID copied to clipboard.',
                  });
                }}
              >
                Copy transaction ID
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem
                disabled={row.original.status.toLowerCase() !== 'success'}
                onSelect={() => setRefundTarget(row.original)}
              >
                Refund payment
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
        ),
      },
    ],
    [toast],
  );

  if (!activeProjectId) {
    return (
      <ZoruEmptyState
        icon={<Receipt />}
        title="No project selected"
        description="Select a project from the home screen to manage its payments."
      />
    );
  }

  const statsLoading = isLoading && transactions.length === 0;

  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Actions strip */}
      <div className="flex flex-wrap items-center gap-2">
        <ZoruDateRangePicker
          value={dateRange}
          onChange={setDateRange}
          className="w-[300px]"
        />
        <ZoruButton
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </ZoruButton>
        <ZoruButton
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={transactions.length === 0}
        >
          <Download />
          Export
        </ZoruButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          hint="from successful transactions"
          icon={<IndianRupee />}
          loading={statsLoading}
        />
        <StatCard
          label="Successful transactions"
          value={stats.successfulTransactions.toLocaleString()}
          hint="payments completed"
          icon={<CheckCircle2 />}
          loading={statsLoading}
        />
        <StatCard
          label="Failed or pending"
          value={(
            transactions.length - stats.successfulTransactions
          ).toLocaleString()}
          hint="awaiting or failed"
          icon={<XCircle />}
          loading={statsLoading}
        />
      </div>

      {/* Chart */}
      <ZoruCard className="p-5">
        <h3 className="text-[15px] text-zoru-ink">Transactions over time</h3>
        <p className="mb-4 text-[12px] text-zoru-ink-muted">
          Revenue curve across the selected date range.
        </p>
        <TransactionChart transactions={transactions} dateRange={dateRange} />
      </ZoruCard>

      {/* Table */}
      <ZoruCard className="p-5">
        <h3 className="text-[15px] text-zoru-ink">Transaction history</h3>
        <p className="mb-4 text-[12px] text-zoru-ink-muted">
          A detailed log of all payments initiated from this platform.
        </p>
        {statsLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-10" />
            ))}
          </div>
        ) : tableData.length === 0 ? (
          <ZoruEmptyState
            icon={<Receipt />}
            title="No transactions yet"
            description="Once customers pay through WhatsApp, the records will appear here."
          />
        ) : (
          <ZoruDataTable
            columns={columns}
            data={tableData}
            filterColumn="description"
            filterPlaceholder="Filter transactions…"
          />
        )}
      </ZoruCard>

      {/* Refund-confirm alert dialog */}
      <ZoruAlertDialog
        open={refundTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Refund this payment?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will request a refund for{' '}
              <span className="text-zoru-ink">
                {refundTarget
                  ? new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                    }).format(refundTarget.amount / 100)
                  : ''}
              </span>
              . Refunds typically settle within 5–10 business days. This action
              cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={refundPending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              disabled={refundPending}
              onClick={() => {
                if (!refundTarget) return;
                startRefundTransition(async () => {
                  // Refund server action is not yet wired — surface a clear
                  // toast and close the dialog. The handler stays in place
                  // for when the action is added.
                  toast({
                    title: 'Refund requested',
                    description: `Refund flow for ${refundTarget.id} is not yet available. Track in Razorpay/PayU console.`,
                  });
                  setRefundTarget(null);
                });
              }}
            >
              Refund payment
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
