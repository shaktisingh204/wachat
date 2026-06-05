'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  type BadgeTone,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  DateRangePicker,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  EmptyState,
  Field,
  Input,
  IconButton,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import type { WithId } from 'mongodb';
import { subDays,
  format } from 'date-fns';
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
  FileText,
  Search,
  } from 'lucide-react';

import { getProjectById } from '@/app/actions/index';
import { getTransactionsForProject, refundTransaction } from '@/app/actions/whatsapp.actions';
import type { Project,
  Transaction } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { TransactionChart } from '@/app/wachat/_components/transaction-chart';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat WhatsApp Pay — Transactions tab (20ui).
 *
 * KPI strip + transaction chart + transaction table with refund-confirm
 * alert dialog.
 */

import { fmtDate, fmtINR } from '@/lib/utils';
import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  description: string;
  date: string;
};

function statusTone(status?: string): BadgeTone {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'captured') return 'success';
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return 'danger';
  if (s === 'pending' || s === 'created') return 'warning';
  return 'neutral';
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
    <Card className="flex items-start gap-4" padding="md">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center [&_svg]:size-5"
        style={{
          borderRadius: 'var(--st-radius)',
          background: 'var(--st-bg-secondary)',
          color: 'var(--st-text)',
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1" height={28} width={96} />
        ) : (
          <p
            className="text-[22px] tabular-nums leading-tight"
            style={{ color: 'var(--st-text)' }}
          >
            {value}
          </p>
        )}
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--st-text-tertiary)' }}>
          {hint}
        </p>
      </div>
    </Card>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function WhatsAppPayPage() {
  const { activeProject } = useProject();
  const [, setProject] = useState<WithId<Project> | null>(null);
  const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filter, setFilter] = useState('');
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
        acc[d] = {
          date: d,
          successfulCount: 0,
          failedCount: 0,
          refundedCount: 0,
          totalRevenue: 0,
          totalRefunded: 0,
        };
      }

      const status = t.status.toUpperCase();
      if (status === 'SUCCESS' || status === 'COMPLETED') {
        acc[d].successfulCount++;
        acc[d].totalRevenue += t.amount / 100;
      } else if (status === 'REFUNDED') {
        acc[d].refundedCount++;
        acc[d].totalRefunded += t.amount / 100;
      } else {
        acc[d].failedCount++;
      }
      return acc;
    }, {});

    const rows = Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((r: any) => ({
      Date: r.date,
      'Successful Transactions': r.successfulCount,
      'Failed/Pending Transactions': r.failedCount,
      'Refunded Transactions': r.refundedCount,
      'Total Revenue (INR)': r.totalRevenue,
      'Total Refunded (INR)': r.totalRefunded,
      'Net Revenue (INR)': r.totalRevenue - r.totalRefunded
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automated-reconciliation-report-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'Reconciliation Generated', description: 'Your automated reconciliation report has been downloaded.' });
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

  const filteredData = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tableData;
    return tableData.filter((r) => r.description.toLowerCase().includes(q));
  }, [tableData, filter]);

  const columns = useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      {
        key: 'date',
        header: 'Date',
        render: (row) => (
          <span className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
            {format(new Date(row.date), 'PPp')}
          </span>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        render: (row) => <span style={{ color: 'var(--st-text)' }}>{row.description}</span>,
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        render: (row) => (
          <div className="text-right tabular-nums" style={{ color: 'var(--st-text)' }}>
            {fmtINR(row.amount / 100)}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Badge tone={statusTone(row.status)} className="capitalize">
            {row.status.toLowerCase()}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <Menu
            align="end"
            label="Transaction actions"
            trigger={
              <IconButton
                label="Open actions menu"
                icon={MoreHorizontal}
                variant="ghost"
                size="sm"
              />
            }
          >
            <MenuLabel>Actions</MenuLabel>
            <MenuItem
              onSelect={() => {
                navigator.clipboard.writeText(row.id);
                toast({
                  title: 'Copied',
                  description: 'Transaction ID copied to clipboard.',
                });
              }}
            >
              Copy transaction ID
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              danger
              disabled={row.status.toLowerCase() !== 'success'}
              onSelect={() => setRefundTarget(row)}
            >
              Refund payment
            </MenuItem>
          </Menu>
        ),
      },
    ],
    [toast],
  );

  if (!activeProjectId) {
    return (
      <WachatPage
        breadcrumb={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'WaChat', href: '/wachat' },
          { label: 'WhatsApp Pay' },
        ]}
        title="WhatsApp Pay"
        description="Track payments, revenue and refunds from your WhatsApp checkout."
        width="wide"
      >
        <EmptyState
          icon={Receipt}
          title="No project selected"
          description="Select a project from the home screen to manage its payments."
        />
      </WachatPage>
    );
  }

  const statsLoading = isLoading && transactions.length === 0;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'WhatsApp Pay' },
      ]}
      title="WhatsApp Pay"
      description="Track payments, revenue and refunds from your WhatsApp checkout."
      width="wide"
    >
      <div className="flex flex-col gap-6">
        {/* Actions strip */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="w-[300px]"
            aria-label="Filter by date range"
          />
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            loading={isLoading}
            onClick={() => fetchData(true)}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={Download}
            onClick={handleExport}
            disabled={transactions.length === 0}
          >
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={FileText}
            onClick={handleGenerateReconciliation}
            disabled={transactions.length === 0}
          >
            Reconciliation Report
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Total revenue"
            value={fmtINR(stats.totalRevenue)}
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
        <Card padding="md">
          <h3 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
            Transactions over time
          </h3>
          <p className="mb-4 text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
            Revenue curve across the selected date range.
          </p>
          <TransactionChart transactions={transactions} dateRange={dateRange} />
        </Card>

        {/* Table */}
        <Card padding="md">
          <h3 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
            Transaction history
          </h3>
          <p className="mb-4 text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
            A detailed log of all payments initiated from this platform.
          </p>
          {statsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </div>
          ) : tableData.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Once customers pay through WhatsApp, the records will appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              <Field className="max-w-xs">
                <Input
                  inputSize="sm"
                  iconLeft={Search}
                  placeholder="Filter transactions…"
                  aria-label="Filter transactions by description"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </Field>
              <DataTable
                columns={columns}
                rows={filteredData}
                getRowId={(row) => row.id}
                empty={
                  <EmptyState
                    icon={Receipt}
                    size="sm"
                    title="No matches"
                    description="No transactions match your filter."
                  />
                }
              />
            </div>
          )}
        </Card>
      </div>

      {/* Refund-confirm alert dialog */}
      <AlertDialog
        open={refundTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will request a refund for{' '}
              <span style={{ color: 'var(--st-text)' }}>
                {refundTarget ? fmtINR(refundTarget.amount / 100) : ''}
              </span>
              . Refunds typically settle within 5–10 business days. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refundPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              intent="danger"
              disabled={refundPending}
              onClick={() => {
                if (!refundTarget) return;
                startRefundTransition(async () => {
                  try {
                    const idempotencyKey = crypto.randomUUID();
                    const timeoutPromise = new Promise<{error: string}>((_, reject) =>
                      setTimeout(() => reject(new Error('Provider API timeout')), 10000)
                    );
                    const res = await Promise.race([
                      refundTransaction(activeProjectId, refundTarget.id, idempotencyKey),
                      timeoutPromise
                    ]) as { error?: string; message?: string };

                    if (res.error) {
                      toast({ title: 'Refund failed', description: res.error, tone: 'danger' });
                    } else {
                      toast({ title: 'Refund requested', description: res.message || 'Refund successfully initiated.' });
                      fetchData(false);
                    }
                  } catch (e: any) {
                    toast({ title: 'Refund failed', description: e.message, tone: 'danger' });
                  } finally {
                    setRefundTarget(null);
                  }
                });
              }}
            >
              Refund payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
