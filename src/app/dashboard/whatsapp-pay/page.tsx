'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Papa from 'papaparse';
import {
  AlertCircle,
  CheckCircle,
  Download,
  IndianRupee,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { getProjectById } from '@/app/actions/index';
import { getTransactionsForProject } from '@/app/actions/whatsapp.actions';
import type { Project, Transaction } from '@/lib/definitions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { DatePickerWithRange } from '@/components/wabasimplify/whatsapp-pay/date-range-picker';
import { TransactionChart } from '@/components/wabasimplify/whatsapp-pay/transaction-chart';
import {
  TransactionTable,
  PaymentTransaction,
} from '@/components/wabasimplify/whatsapp-pay/transaction-table';

import {
  SabButton,
  SabCard,
  SabCardBody,
  SabCardHeader,
  SabPageHeader,
  SabPageShell,
  SabStat,
} from '@/components/sab-ui';

export default function WhatsAppPayPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

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
    const storedId = localStorage.getItem('activeProjectId');
    setActiveProjectId(storedId);
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      fetchData();
    }
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
      <SabPageShell>
        <SabPageHeader
          hero
          eyebrow="Wachat · WhatsApp Pay"
          title="Payment overview"
          description="Manage payment requests and transaction history for your WhatsApp Business Account."
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Please select a project from the main dashboard to manage its payments.
          </AlertDescription>
        </Alert>
      </SabPageShell>
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
    <SabPageShell>
      <SabPageHeader
        hero
        eyebrow="Wachat · WhatsApp Pay"
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'WhatsApp Pay' },
        ]}
        title="Payment overview"
        description={
          project?.name
            ? `Payment history and revenue for ${project.name}.`
            : 'View payment history and revenue for this project.'
        }
        actions={
          <div className="flex items-center gap-2">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            <SabButton
              variant="secondary"
              leftIcon={RefreshCw}
              loading={isLoading}
              onClick={() => fetchData(true)}
            >
              Refresh
            </SabButton>
            <SabButton variant="secondary" leftIcon={Download} onClick={handleExport}>
              Export
            </SabButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <SabStat
          hero
          label="Total revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          hint="from successful transactions"
          icon={IndianRupee}
          tone="success"
          loading={statsLoading}
        />
        <SabStat
          hero
          label="Successful transactions"
          value={stats.successfulTransactions.toLocaleString()}
          hint="payments completed"
          icon={CheckCircle}
          tone="primary"
          loading={statsLoading}
        />
        <SabStat
          hero
          label="Failed or pending"
          value={(transactions.length - stats.successfulTransactions).toLocaleString()}
          hint="awaiting or failed"
          icon={XCircle}
          tone="danger"
          loading={statsLoading}
        />
      </div>

      <SabCard variant="hero" glow="primary">
        <SabCardHeader
          title="Transactions over time"
          description="Revenue curve across the selected date range."
        />
        <SabCardBody>
          <TransactionChart transactions={transactions} dateRange={dateRange} />
        </SabCardBody>
      </SabCard>

      <SabCard variant="featured">
        <SabCardHeader
          title="Transaction history"
          description="A detailed log of all payments initiated from this platform."
        />
        <SabCardBody>
          <TransactionTable data={tableData} />
        </SabCardBody>
      </SabCard>
    </SabPageShell>
  );
}
