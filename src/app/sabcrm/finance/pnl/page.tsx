/**
 * SabCRM Finance — Profit & loss (`/sabcrm/finance/pnl`), read-only
 * 20ui report.
 *
 * Server-rendered over `getSabcrmPnl` for an Indian FY (Apr–Mar):
 * monthly revenue (invoices) vs expenses (bills + approved expense
 * claims) with FY totals. Period switching is link-based (`?fy=2025`).
 */

import * as React from 'react';

import { StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmPnl } from '@/app/actions/sabcrm-statements.actions';
import {
  formatINR,
  PeriodSwitcher,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Profit & loss — SabCRM Finance',
};

function currentFyStart(): number {
  const now = new Date();
  return now.getUTCMonth() + 1 >= 4
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

interface PageProps {
  searchParams: Promise<{ fy?: string }>;
}

export default async function SabcrmPnlPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const nowFy = currentFyStart();
  const requested = Number(params.fy);
  const fy =
    Number.isFinite(requested) && requested >= 2000 && requested <= nowFy + 1
      ? requested
      : nowFy;

  const res = await getSabcrmPnl(fy);
  const data = res.ok ? res.data : null;

  const fyLinks = [nowFy - 2, nowFy - 1, nowFy].map((y) => ({
    label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`,
    href: `/sabcrm/finance/pnl?fy=${y}`,
    active: y === fy,
  }));

  const hasActivity =
    !!data && (data.totalRevenue > 0 || data.totalExpenses > 0);

  return (
    <ReportShell
      title="Profit & loss"
      description="Monthly revenue vs expenses for the financial year — part of the SabCRM Finance suite."
      actions={<PeriodSwitcher links={fyLinks} label="Financial year" />}
      error={res.ok ? null : res.error}
      methodology="Revenue = invoice totals (drafts and cancelled excluded) by invoice date. Expenses = vendor bill totals plus approved/reimbursed expense claims. Indian FY buckets (Apr–Mar); amounts summed across currencies as-is."
    >
      {data ? (
        !hasActivity ? (
          <ReportEmpty
            message={`No invoices, bills or expenses dated in FY ${data.fyLabel} yet.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label={`Revenue (FY ${data.fyLabel})`}
                value={formatINR(data.totalRevenue)}
              />
              <StatCard
                label="Expenses"
                value={formatINR(data.totalExpenses)}
              />
              <StatCard
                label={data.netProfit >= 0 ? 'Net profit' : 'Net loss'}
                value={formatINR(Math.abs(data.netProfit))}
                delta={{
                  value: data.netProfit >= 0 ? 'profit' : 'loss',
                  tone: data.netProfit >= 0 ? 'up' : 'down',
                }}
              />
            </div>

            <Table hover>
              <THead>
                <Tr>
                  <Th>Month</Th>
                  <Th align="right">Revenue</Th>
                  <Th align="right">Expenses</Th>
                  <Th align="right">Net</Th>
                </Tr>
              </THead>
              <TBody>
                {data.months.map((m) => (
                  <Tr key={m.month}>
                    <Td>{m.month}</Td>
                    <Td align="right">{formatINR(m.revenue)}</Td>
                    <Td align="right">{formatINR(m.expenses)}</Td>
                    <Td align="right">{formatINR(m.net)}</Td>
                  </Tr>
                ))}
              </TBody>
              <TFoot>
                <Tr>
                  <Td>FY {data.fyLabel} totals</Td>
                  <Td align="right">{formatINR(data.totalRevenue)}</Td>
                  <Td align="right">{formatINR(data.totalExpenses)}</Td>
                  <Td align="right">{formatINR(data.netProfit)}</Td>
                </Tr>
              </TFoot>
            </Table>

            <p className="text-xs text-[var(--ui20-color-text-muted,#6b7280)]">
              Expense split: bills {formatINR(data.totalBills)} · expense
              claims {formatINR(data.totalExpenseClaims)}.
            </p>
          </>
        )
      ) : null}
    </ReportShell>
  );
}
