/**
 * SabCRM Finance — Cash flow (`/sabcrm/finance/cash-flow`), read-only
 * 20ui report.
 *
 * Server-rendered over `getSabcrmCashFlow`: monthly inflows (payment
 * receipts) vs outflows (payouts + approved expenses) with a running
 * cash position. Period switching is link-based (`?year=2025`).
 */

import * as React from 'react';

import { StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmCashFlow } from '@/app/actions/sabcrm-statements.actions';
import {
  formatINR,
  PeriodSwitcher,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cash flow — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function SabcrmCashFlowPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const nowYear = new Date().getUTCFullYear();
  const requested = Number(params.year);
  const year =
    Number.isFinite(requested) && requested >= 2000 && requested <= nowYear + 1
      ? requested
      : nowYear;

  const res = await getSabcrmCashFlow(year);
  const data = res.ok ? res.data : null;

  const yearLinks = [nowYear - 2, nowYear - 1, nowYear].map((y) => ({
    label: String(y),
    href: `/sabcrm/finance/cash-flow?year=${y}`,
    active: y === year,
  }));

  const hasActivity =
    !!data && (data.totalInflow > 0 || data.totalOutflow > 0);

  return (
    <ReportShell
      title="Cash flow"
      description="Monthly money in vs money out with the running cash position — part of the SabCRM Finance suite."
      actions={<PeriodSwitcher links={yearLinks} label="Calendar year" />}
      error={res.ok ? null : res.error}
      methodology="Inflows = payment receipts (bounced excluded); outflows = vendor payouts + approved/reimbursed expense claims, bucketed by document date (calendar year). Opening cash folds in all prior-year activity across the same documents."
    >
      {data ? (
        !hasActivity ? (
          <ReportEmpty
            message={`No receipts, payouts or expenses dated in ${data.year} yet.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <StatCard
                label={`Opening cash (1 Jan ${data.year})`}
                value={formatINR(data.openingCash)}
              />
              <StatCard
                label="Total inflow"
                value={formatINR(data.totalInflow)}
              />
              <StatCard
                label="Total outflow"
                value={formatINR(data.totalOutflow)}
              />
              <StatCard
                label="Closing cash"
                value={formatINR(data.closingCash)}
              />
            </div>

            <Table hover>
              <THead>
                <Tr>
                  <Th>Month</Th>
                  <Th align="right">Inflow</Th>
                  <Th align="right">Outflow</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Closing</Th>
                </Tr>
              </THead>
              <TBody>
                {data.months.map((m) => (
                  <Tr key={m.month}>
                    <Td>{m.month}</Td>
                    <Td align="right">{formatINR(m.inflow)}</Td>
                    <Td align="right">{formatINR(m.outflow)}</Td>
                    <Td align="right">{formatINR(m.net)}</Td>
                    <Td align="right">{formatINR(m.closing)}</Td>
                  </Tr>
                ))}
              </TBody>
              <TFoot>
                <Tr>
                  <Td>{data.year} totals</Td>
                  <Td align="right">{formatINR(data.totalInflow)}</Td>
                  <Td align="right">{formatINR(data.totalOutflow)}</Td>
                  <Td align="right">
                    {formatINR(data.totalInflow - data.totalOutflow)}
                  </Td>
                  <Td align="right">{formatINR(data.closingCash)}</Td>
                </Tr>
              </TFoot>
            </Table>
          </>
        )
      ) : null}
    </ReportShell>
  );
}
