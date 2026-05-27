'use client';

import * as React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import type { WithId } from 'mongodb';
import { subDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Papa from 'papaparse';
import { m } from 'motion/react';
import {
  IndianRupee,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  MoreHorizontal,
  Receipt,
  FileText,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { getProjectById } from '@/app/actions/index';
import { getTransactionsForProject, refundTransaction } from '@/app/actions/whatsapp.actions';
import type { Project, Transaction } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { TransactionChart } from '@/app/wachat/_components/transaction-chart';
import { fmtDate, fmtINR } from '@/lib/utils';

import {
  DataTable,
  ZoruDateRangePicker,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  description: string;
  date: string;
};

const statusTone = (status?: string): StatusTone => {
  const s = (status ?? '').toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'captured') return 'live';
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return 'failed';
  if (s === 'pending' || s === 'created') return 'queued';
  return 'draft';
};

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
        if (showToast) toast({ title: 'Refreshed', description: 'Payment data updated.' });
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
        Date: fmtDate(t.createdAt),
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

  const handleGenerateReconciliation = () => {
    if (!transactions.length) return;
    const grouped = transactions.reduce((acc: any, t) => {
      const d = format(new Date(t.createdAt), 'yyyy-MM-dd');
      if (!acc[d]) {
        acc[d] = { date: d, successfulCount: 0, failedCount: 0, refundedCount: 0, totalRevenue: 0, totalRefunded: 0 };
      }
      const status = t.status.toUpperCase();
      if (status === 'SUCCESS' || status === 'COMPLETED') { acc[d].successfulCount++; acc[d].totalRevenue += t.amount / 100; }
      else if (status === 'REFUNDED') { acc[d].refundedCount++; acc[d].totalRefunded += t.amount / 100; }
      else { acc[d].failedCount++; }
      return acc;
    }, {});

    const rows = Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((r: any) => ({
      Date: r.date,
      'Successful transactions': r.successfulCount,
      'Failed or pending transactions': r.failedCount,
      'Refunded transactions': r.refundedCount,
      'Total revenue (INR)': r.totalRevenue,
      'Total refunded (INR)': r.totalRefunded,
      'Net revenue (INR)': r.totalRevenue - r.totalRefunded,
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'Reconciliation generated', description: 'CSV report downloaded.' });
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
        cell: ({ row }) => <span className="text-[12px] text-zinc-500">{format(new Date(row.original.date), 'PPp')}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <span className="text-zinc-900">{row.original.description}</span>,
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => (
          <div className="text-right font-semibold tabular-nums text-zinc-900">{fmtINR(row.original.amount / 100)}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusPill tone={statusTone(row.original.status)}>{row.original.status.toLowerCase()}</StatusPill>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open actions"
                className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94]"
              >
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem
                onSelect={() => {
                  navigator.clipboard.writeText(row.original.id);
                  toast({ title: 'Copied', description: 'Transaction ID copied to clipboard.' });
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
          </DropdownMenu>
        ),
      },
    ],
    [toast],
  );

  if (!activeProjectId) {
    return (
      <EmptyState
        icon={Receipt}
        title="No project selected"
        description="Pick a project from the home screen to manage its payments."
      />
    );
  }

  const statsLoading = isLoading && transactions.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Actions strip */}
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="flex flex-wrap items-center gap-2"
      >
        <ZoruDateRangePicker value={dateRange} onChange={setDateRange} className="w-[300px]" />
        <WaButton variant="outline" size="sm" onClick={() => fetchData(true)} disabled={isLoading} leftIcon={RefreshCw}>
          Refresh
        </WaButton>
        <WaButton variant="outline" size="sm" onClick={handleExport} disabled={transactions.length === 0} leftIcon={Download}>
          Export
        </WaButton>
        <WaButton variant="outline" size="sm" onClick={handleGenerateReconciliation} disabled={transactions.length === 0} leftIcon={FileText}>
          Reconciliation
        </WaButton>
      </m.div>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricTile label="Total revenue" value={fmtINR(stats.totalRevenue)} icon={IndianRupee} delay={0.02} />
        <MetricTile label="Successful payments" value={stats.successfulTransactions.toLocaleString('en-IN')} icon={CheckCircle2} delay={0.06} />
        <MetricTile label="Failed or pending" value={(transactions.length - stats.successfulTransactions).toLocaleString('en-IN')} icon={XCircle} delay={0.1} />
      </section>

      {/* Chart */}
      <Section title="Transactions over time" description="Revenue curve across the selected range.">
        <TransactionChart transactions={transactions} dateRange={dateRange} />
      </Section>

      {/* Table */}
      <Section title="Transaction history" description="A detailed log of every payment from chat.">
        {statsLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        ) : tableData.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Once customers pay through WhatsApp, the records will appear here."
          />
        ) : (
          <DataTable columns={columns} data={tableData} filterColumn="description" filterPlaceholder="Filter transactions..." />
        )}
      </Section>

      {/* Refund confirm */}
      <ZoruAlertDialog open={refundTarget !== null} onOpenChange={(open) => { if (!open) setRefundTarget(null); }}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Refund this payment?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This issues a refund for <span className="font-semibold text-zinc-900">{refundTarget ? fmtINR(refundTarget.amount / 100) : ''}</span>. Refunds typically settle within 5 to 10 business days and cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={refundPending}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              disabled={refundPending}
              onClick={() => {
                if (!refundTarget) return;
                startRefundTransition(async () => {
                  try {
                    const idempotencyKey = crypto.randomUUID();
                    const timeoutPromise = new Promise<{ error: string }>((_, reject) =>
                      setTimeout(() => reject(new Error('Provider API timeout')), 10000),
                    );
                    const res = (await Promise.race([
                      refundTransaction(activeProjectId, refundTarget.id, idempotencyKey),
                      timeoutPromise,
                    ])) as { error?: string; message?: string };
                    if (res.error) {
                      toast({ title: 'Refund failed', description: res.error, variant: 'destructive' });
                    } else {
                      toast({ title: 'Refund requested', description: res.message || 'Refund successfully initiated.' });
                      fetchData(false);
                    }
                  } catch (e: any) {
                    toast({ title: 'Refund failed', description: e.message, variant: 'destructive' });
                  } finally {
                    setRefundTarget(null);
                  }
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
