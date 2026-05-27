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
  TrendingUp,
  Users,
  RotateCcw,
  Activity,
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
  customer?: string;
};

const statusTone = (status?: string): StatusTone => {
  const s = (status ?? '').toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'captured') return 'live';
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return 'failed';
  if (s === 'pending' || s === 'created') return 'queued';
  if (s === 'refunded') return 'paused';
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

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let successfulCount = 0;
    let totalRevenue = 0;
    let failedCount = 0;
    let refundedCount = 0;
    let refundedAmount = 0;
    let txToday = 0;
    let volumeToday = 0;
    let initiatedCount = 0;
    const customers = new Map<string, number>();
    for (const t of transactions) {
      const status = (t.status ?? '').toUpperCase();
      const amount = t.amount / 100;
      const desc = t.description || '-';
      if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'CAPTURED') {
        successfulCount++; totalRevenue += amount;
        customers.set(desc, (customers.get(desc) || 0) + amount);
      } else if (status === 'REFUNDED') { refundedCount++; refundedAmount += amount; }
      else if (status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED') { failedCount++; }
      else if (status === 'PENDING' || status === 'CREATED') { initiatedCount++; }
      const created = t.createdAt ? new Date(t.createdAt as unknown as string | Date).toISOString().slice(0, 10) : '';
      if (created === today) {
        txToday++;
        if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'CAPTURED') volumeToday += amount;
      }
    }
    let topCustomer = '-'; let topAmount = 0;
    for (const [k, v] of customers) if (v > topAmount) { topCustomer = k; topAmount = v; }
    const avgAmount = successfulCount > 0 ? totalRevenue / successfulCount : 0;
    const successRate = transactions.length > 0 ? (successfulCount / transactions.length) * 100 : 0;
    return {
      successfulCount, totalRevenue, failedCount, refundedCount, refundedAmount,
      txToday, volumeToday, avgAmount, successRate, topCustomer, topAmount, initiatedCount,
    };
  }, [transactions]);

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
        cell: ({ row }) => <span className="text-[11.5px] text-zinc-500 tabular-nums">{format(new Date(row.original.date), 'dd MMM, HH:mm')}</span>,
      },
      {
        accessorKey: 'id',
        header: 'TX ID',
        cell: ({ row }) => <span className="font-mono text-[11px] text-zinc-500">{row.original.id.slice(-10)}</span>,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <span className="text-[12.5px] text-zinc-900">{row.original.description}</span>,
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => (
          <div className="text-right text-[12.5px] font-semibold tabular-nums text-zinc-900">{fmtINR(row.original.amount / 100)}</div>
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
                className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.94]"
              >
                <MoreHorizontal className="h-3 w-3" strokeWidth={2.25} />
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

  // Funnel
  const funnel = useMemo(() => {
    const initiated = stats.initiatedCount + stats.successfulCount + stats.failedCount + stats.refundedCount;
    return [
      { label: 'Initiated', value: initiated, color: '#a1a1aa' },
      { label: 'Paid', value: stats.successfulCount, color: '#25D366' },
      { label: 'Refunded', value: stats.refundedCount, color: '#f59e0b' },
    ];
  }, [stats]);
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div className="flex flex-col gap-4">
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
          Export CSV
        </WaButton>
        <WaButton variant="outline" size="sm" onClick={handleGenerateReconciliation} disabled={transactions.length === 0} leftIcon={FileText}>
          Reconciliation
        </WaButton>
      </m.div>

      {/* 6-tile KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Today" value={stats.txToday.toLocaleString('en-IN')} icon={Activity} delay={0.02} />
        <MetricTile label="Volume" value={fmtINR(stats.totalRevenue)} icon={IndianRupee} delay={0.04} />
        <MetricTile label="Success rate" value={`${stats.successRate.toFixed(1)}%`} icon={CheckCircle2} delay={0.06} />
        <MetricTile label="Refunds" value={stats.refundedCount.toLocaleString('en-IN')} icon={RotateCcw} delay={0.08} />
        <MetricTile label="Avg amount" value={fmtINR(stats.avgAmount)} icon={TrendingUp} delay={0.1} />
        <MetricTile label="Top customer" value={stats.topAmount > 0 ? fmtINR(stats.topAmount) : '-'} icon={Users} delay={0.12} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Chart */}
        <Section title="Transactions over time" description="Revenue curve across the selected range.">
          <TransactionChart transactions={transactions} dateRange={dateRange} />
        </Section>

        {/* Funnel */}
        <Section title="Payment funnel" description="From intent to settlement.">
          <ul className="flex flex-col gap-2">
            {funnel.map((f) => {
              const pct = (f.value / funnelMax) * 100;
              return (
                <li key={f.label}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-semibold text-zinc-700">{f.label}</span>
                    <span className="tabular-nums text-zinc-900">{f.value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: EASE_OUT }}
                      style={{ background: f.color }}
                      className="h-full"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-[11px]">
            <div>
              <p className="font-semibold uppercase tracking-wider text-zinc-500">Refunded volume</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-900">{fmtINR(stats.refundedAmount)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wider text-zinc-500">Volume today</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-zinc-900">{fmtINR(stats.volumeToday)}</p>
            </div>
          </div>
        </Section>
      </div>

      {/* Table */}
      <Section title="Transaction history" description="A detailed log of every payment from chat.">
        {statsLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-100" />
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
