import React from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  StatCard,
  Badge,
  type BadgeTone,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  Wallet,
  Receipt,
  TrendingUp,
  Landmark,
  ArrowUpRight,
  Plus,
  FileBarChart,
  ScanLine,
  ArrowLeftRight,
} from 'lucide-react';
import { fmtINR } from '@/lib/utils';
import { CashFlowChart } from './_components/cash-flow-chart';

/** Recent ledger movement — realistic, varied sample data for the overview. */
type Movement = {
  id: string;
  party: string;
  ref: string;
  amount: number;
  direction: 'in' | 'out';
  status: 'cleared' | 'pending' | 'failed';
};

const RECENT_MOVEMENTS: Movement[] = [
  { id: 'm1', party: 'Brightloom Studios', ref: 'INV-2048', amount: 184250, direction: 'in', status: 'cleared' },
  { id: 'm2', party: 'AWS EMEA SARL', ref: 'BILL-7741', amount: 41280, direction: 'out', status: 'cleared' },
  { id: 'm3', party: 'Kavya Menon', ref: 'PAYOUT-318', amount: 62000, direction: 'out', status: 'pending' },
  { id: 'm4', party: 'Northwind Traders', ref: 'INV-2046', amount: 97600, direction: 'in', status: 'cleared' },
  { id: 'm5', party: 'Zoho Corp renewal', ref: 'BILL-7739', amount: 3299, direction: 'out', status: 'failed' },
];

const STATUS_TONE: Record<Movement['status'], BadgeTone> = {
  cleared: 'success',
  pending: 'warning',
  failed: 'danger',
};

const QUICK_ACTIONS: ReadonlyArray<{
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    href: '/dashboard/finance/vouchers',
    label: 'Record a voucher',
    description: 'Journal, payment, receipt or contra entry',
    icon: <Receipt size={18} aria-hidden="true" />,
  },
  {
    href: '/dashboard/finance/banking',
    label: 'Reconcile banking',
    description: 'Match bank lines to ledger vouchers',
    icon: <ArrowLeftRight size={18} aria-hidden="true" />,
  },
  {
    href: '/dashboard/finance/reports',
    label: 'Open reports',
    description: 'Trial balance, P&L and balance sheet',
    icon: <FileBarChart size={18} aria-hidden="true" />,
  },
];

export default function FinanceDashboardPage(): React.JSX.Element {
  return (
    <main className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Finance</PageEyebrow>
          <PageTitle>Financial overview</PageTitle>
          <PageDescription>
            A live read on cash, receivables and payables across your accounts.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/finance/reports">
              <FileBarChart size={16} aria-hidden="true" />
              View reports
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/finance/vouchers">
              <Plus size={16} aria-hidden="true" />
              New voucher
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {/* KPI strip */}
      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={fmtINR(4523189)}
          icon={Wallet}
          accent="#2563eb"
          delta={{ value: '+20.1% MoM', tone: 'up' }}
        />
        <StatCard
          label="Accounts receivable"
          value={fmtINR(1245000)}
          icon={TrendingUp}
          accent="#0891b2"
          delta={{ value: '8 invoices open', tone: 'neutral' }}
        />
        <StatCard
          label="Accounts payable"
          value={fmtINR(821050)}
          icon={Receipt}
          accent="#d97706"
          delta={{ value: '-4.0% MoM', tone: 'down' }}
        />
        <StatCard
          label="Cash at bank"
          value={fmtINR(8943200)}
          icon={Landmark}
          accent="#16a34a"
          delta={{ value: 'Across 3 accounts', tone: 'neutral' }}
        />
      </section>

      {/* Chart + recent movement (asymmetric) */}
      <section aria-label="Cash flow and recent activity" className="grid gap-4 lg:grid-cols-3">
        <Card variant="outlined" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={18} aria-hidden="true" />
              Cash flow
            </CardTitle>
            <CardDescription>Weekly money in versus money out, last 12 weeks.</CardDescription>
          </CardHeader>
          <CardBody>
            <CashFlowChart />
          </CardBody>
        </Card>

        <Card variant="outlined">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight size={18} aria-hidden="true" />
              Recent movement
            </CardTitle>
            <CardDescription>Latest cleared and pending entries.</CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 p-2">
            {RECENT_MOVEMENTS.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] px-2 py-2 transition-colors hover:bg-[var(--st-bg-muted)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--st-text)]">{m.party}</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">{m.ref}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={[
                      'text-sm font-semibold tabular-nums',
                      m.direction === 'in' ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-text)]',
                    ].join(' ')}
                  >
                    {m.direction === 'in' ? '+' : '−'}
                    {fmtINR(m.amount)}
                  </span>
                  <Badge tone={STATUS_TONE[m.status]} dot>
                    {m.status}
                  </Badge>
                </div>
              </div>
            ))}
            <Separator className="my-1" />
            <Button asChild variant="ghost" size="sm" className="justify-start">
              <Link href="/dashboard/finance/gl">
                Open general ledger
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </Button>
          </CardBody>
        </Card>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 transition-all hover:border-[var(--st-accent)] hover:shadow-[var(--st-shadow-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--st-accent)] active:translate-y-px"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
              aria-hidden="true"
            >
              {a.icon}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-medium text-[var(--st-text)]">
                {a.label}
                <ArrowUpRight
                  size={14}
                  aria-hidden="true"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                />
              </span>
              <span className="mt-0.5 block text-xs text-[var(--st-text-secondary)]">{a.description}</span>
            </span>
          </Link>
        ))}
      </section>

      <p className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
        <ScanLine size={13} aria-hidden="true" />
        Figures shown are illustrative until your first synced statement period closes.
      </p>
    </main>
  );
}
