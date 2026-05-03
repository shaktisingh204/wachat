'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Papa from 'papaparse';
import {
  LuIndianRupee,
  LuCircleCheck,
  LuCircleX,
  LuDownload,
  LuRefreshCw,
} from 'react-icons/lu';

import { getProjectById } from '@/app/actions/index';
import { getTransactionsForProject } from '@/app/actions/whatsapp.actions';
import type { Project, Transaction } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';
import { DatePickerWithRange } from '@/components/wabasimplify/whatsapp-pay/date-range-picker';
import { TransactionChart } from '@/components/wabasimplify/whatsapp-pay/transaction-chart';
import {
  TransactionTable,
  PaymentTransaction,
} from '@/components/wabasimplify/whatsapp-pay/transaction-table';

import { ClayCard, ClayButton } from '@/components/clay';

/* ── stat card ────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: 'green' | 'rose' | 'red';
  loading?: boolean;
}) {
  const toneMap = {
    green: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-accent text-primary',
    red: 'bg-red-50 text-red-500',
  };

  return (
    <ClayCard className="flex items-start gap-4 p-5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneMap[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1 h-7 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className="text-[22px] font-semibold tabular-nums text-foreground leading-tight">
            {value}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </ClayCard>
  );
}

/* ── page ──────────────────────────────────────────────────────── */

export default function WhatsAppPayPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

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

  const stats = transactions.reduce(
    (acc, t) => {
      if (t.status === 'SUCCESS') {
        acc.successfulTransactions++;
        acc.totalRevenue += t.amount / 100;
      }
      return acc;
    },
    { successfulTransactions: 0, totalRevenue: 0 },
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
  };

  if (!activeProjectId) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-red-50 p-4 text-[13px] text-destructive">
        No project selected. Please select a project from the main dashboard to
        manage its payments.
      </div>
    );
  }

  const statsLoading = isLoading && !project;

  const tableData: PaymentTransaction[] = transactions.map((t) => ({
    id: t._id.toString(),
    amount: t.amount,
    status: t.status,
    description: t.description,
    date: t.createdAt.toString(),
  }));

  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Actions strip */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        <ClayButton
          variant="pill"
          size="sm"
          leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={() => fetchData(true)}
        >
          Refresh
        </ClayButton>
        <ClayButton
          variant="pill"
          size="sm"
          leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={handleExport}
        >
          Export
        </ClayButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          hint="from successful transactions"
          icon={<LuIndianRupee className="h-5 w-5" strokeWidth={2} />}
          tone="green"
          loading={statsLoading}
        />
        <StatCard
          label="Successful transactions"
          value={stats.successfulTransactions.toLocaleString()}
          hint="payments completed"
          icon={<LuCircleCheck className="h-5 w-5" strokeWidth={2} />}
          tone="rose"
          loading={statsLoading}
        />
        <StatCard
          label="Failed or pending"
          value={(
            transactions.length - stats.successfulTransactions
          ).toLocaleString()}
          hint="awaiting or failed"
          icon={<LuCircleX className="h-5 w-5" strokeWidth={2} />}
          tone="red"
          loading={statsLoading}
        />
      </div>

      {/* Chart */}
      <ClayCard className="p-5">
        <h3 className="text-[15px] font-semibold text-foreground">
          Transactions over time
        </h3>
        <p className="mb-4 text-[12px] text-muted-foreground">
          Revenue curve across the selected date range.
        </p>
        <TransactionChart transactions={transactions} dateRange={dateRange} />
      </ClayCard>

      {/* Table */}
      <ClayCard className="p-5">
        <h3 className="text-[15px] font-semibold text-foreground">
          Transaction history
        </h3>
        <p className="mb-4 text-[12px] text-muted-foreground">
          A detailed log of all payments initiated from this platform.
        </p>
        <TransactionTable data={tableData} />
      </ClayCard>
    </div>
  );
}
