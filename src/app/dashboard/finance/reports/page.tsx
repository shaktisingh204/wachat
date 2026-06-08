'use client';

import React, { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Badge,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  SegmentedControl,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { Download, Printer, Scale, BookOpen, TrendingUp, Wallet } from 'lucide-react';
import { fmtINR } from '@/lib/utils';
import { PlTrendChart } from './_components/pl-trend-chart';

type ReportKey = 'trial_balance' | 'pl' | 'balance_sheet';

const REPORT_OPTIONS: ReadonlyArray<{ value: ReportKey; label: string }> = [
  { value: 'trial_balance', label: 'Trial balance' },
  { value: 'pl', label: 'Profit & loss' },
  { value: 'balance_sheet', label: 'Balance sheet' },
];

const REPORT_META: Record<ReportKey, { title: string; description: string }> = {
  trial_balance: {
    title: 'Trial balance',
    description: 'All ledger balances as of today, debits against credits.',
  },
  pl: {
    title: 'Profit & loss',
    description: 'Revenue against expenses for the current financial year.',
  },
  balance_sheet: {
    title: 'Balance sheet',
    description: 'Assets, liabilities and equity as of today.',
  },
};

const TRIAL_BALANCE: ReadonlyArray<{ account: string; debit?: number; credit?: number }> = [
  { account: 'Cash in hand', debit: 45000 },
  { account: 'Bank accounts', debit: 125000 },
  { account: 'Accounts receivable', debit: 180000 },
  { account: 'Sales account', credit: 350000 },
  { account: 'Capital account', credit: 500000 },
];

const BALANCE_SHEET: ReadonlyArray<{ line: string; group: 'Assets' | 'Liabilities & equity'; amount: number }> = [
  { line: 'Cash and bank', group: 'Assets', amount: 170000 },
  { line: 'Accounts receivable', group: 'Assets', amount: 180000 },
  { line: 'Fixed assets (net)', group: 'Assets', amount: 320000 },
  { line: 'Accounts payable', group: 'Liabilities & equity', amount: 121000 },
  { line: 'Owner equity', group: 'Liabilities & equity', amount: 549000 },
];

export default function ReportsPage(): React.JSX.Element {
  const [activeReport, setActiveReport] = useState<ReportKey>('trial_balance');
  const meta = REPORT_META[activeReport];

  const totalDebit = TRIAL_BALANCE.reduce((a, r) => a + (r.debit ?? 0), 0);
  const totalCredit = TRIAL_BALANCE.reduce((a, r) => a + (r.credit ?? 0), 0);
  const totalAssets = BALANCE_SHEET.filter((r) => r.group === 'Assets').reduce((a, r) => a + r.amount, 0);

  return (
    <main className="20ui mx-auto flex w-full max-w-[1100px] flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Finance</PageEyebrow>
          <PageTitle>Reports</PageTitle>
          <PageDescription>Interactive statements that recompute as your ledgers change.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="outline" size="sm" iconLeft={Printer}>
            Print
          </Button>
          <Button variant="primary" size="sm" iconLeft={Download}>
            Export Excel
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Headline figures" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue (FY)" value={fmtINR(2014000)} icon={Wallet} accent="#2563eb" />
        <StatCard label="Net profit (FY)" value={fmtINR(611000)} icon={TrendingUp} accent="#16a34a" />
        <StatCard label="Total assets" value={fmtINR(totalAssets)} icon={Scale} accent="#0891b2" />
      </section>

      <SegmentedControl
        aria-label="Select report"
        items={REPORT_OPTIONS}
        value={activeReport}
        onChange={setActiveReport}
      />

      <Card variant="outlined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen size={18} aria-hidden="true" />
            {meta.title}
          </CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardBody>
          {activeReport === 'trial_balance' && (
            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Particulars</Th>
                    <Th align="right">Debit</Th>
                    <Th align="right">Credit</Th>
                  </Tr>
                </THead>
                <TBody>
                  {TRIAL_BALANCE.map((r) => (
                    <Tr key={r.account}>
                      <Td className="font-medium">{r.account}</Td>
                      <Td align="right" className="tabular-nums">
                        {r.debit ? fmtINR(r.debit) : '—'}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {r.credit ? fmtINR(r.credit) : '—'}
                      </Td>
                    </Tr>
                  ))}
                  <Tr className="border-t-2 border-[var(--st-border)] font-semibold">
                    <Td>Total</Td>
                    <Td align="right" className="tabular-nums">
                      {fmtINR(totalDebit)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {fmtINR(totalCredit)}
                    </Td>
                  </Tr>
                </TBody>
              </Table>
            </div>
          )}

          {activeReport === 'pl' && <PlTrendChart />}

          {activeReport === 'balance_sheet' && (
            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Line item</Th>
                    <Th>Group</Th>
                    <Th align="right">Amount</Th>
                  </Tr>
                </THead>
                <TBody>
                  {BALANCE_SHEET.map((r) => (
                    <Tr key={r.line}>
                      <Td className="font-medium">{r.line}</Td>
                      <Td>
                        <Badge tone={r.group === 'Assets' ? 'info' : 'neutral'}>{r.group}</Badge>
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {fmtINR(r.amount)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
