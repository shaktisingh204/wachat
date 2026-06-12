/**
 * SabCRM Finance — Balance sheet (`/sabcrm/finance/balance-sheet`),
 * read-only 20ui report.
 *
 * Server-rendered over `getSabcrmBalanceSheet`: cash (receipts −
 * payouts − expenses), accounts receivable (open invoice balances),
 * accounts payable (open bill balances), with retained earnings as the
 * derived balancing figure.
 */

import * as React from 'react';

import { Card, CardBody, CardHeader, CardTitle, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmBalanceSheet } from '@/app/actions/sabcrm-statements.actions';
import {
  formatINR,
  formatReportDate,
  ReportShell,
} from '../_components/finance-report';
import type { SabcrmBalanceSheetLine } from '@/app/actions/sabcrm-statements.actions.types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Balance sheet — SabCRM Finance',
};

function Section({
  title,
  lines,
  total,
  totalLabel,
}: {
  title: string;
  lines: SabcrmBalanceSheetLine[];
  total: number;
  totalLabel: string;
}): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <Table>
          <THead>
            <Tr>
              <Th>Line</Th>
              <Th align="right">Amount</Th>
            </Tr>
          </THead>
          <TBody>
            {lines.map((line) => (
              <Tr key={line.label}>
                <Td>
                  {line.label}
                  {line.note ? (
                    <span className="block text-xs text-[var(--ui20-color-text-muted,#6b7280)]">
                      {line.note}
                    </span>
                  ) : null}
                </Td>
                <Td align="right">{formatINR(line.amount)}</Td>
              </Tr>
            ))}
          </TBody>
          <TFoot>
            <Tr>
              <Td>{totalLabel}</Td>
              <Td align="right">{formatINR(total)}</Td>
            </Tr>
          </TFoot>
        </Table>
      </CardBody>
    </Card>
  );
}

export default async function SabcrmBalanceSheetPage(): Promise<React.JSX.Element> {
  const res = await getSabcrmBalanceSheet();
  const data = res.ok ? res.data : null;

  return (
    <ReportShell
      title="Balance sheet"
      description="Assets vs liabilities & equity for this workspace — part of the SabCRM Finance suite."
      error={res.ok ? null : res.error}
      methodology="Simplified statement over the workspace's finance documents: cash = payment receipts − payouts − approved expenses; receivable/payable = unpaid balances on open invoices/bills; retained earnings is the balancing figure (assets − liabilities), so the sheet always ties. Fixed assets, loans and tax provisions are not yet modelled."
    >
      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label={`Total assets (as of ${formatReportDate(data.asOf)})`}
              value={formatINR(data.totalAssets)}
            />
            <StatCard
              label="Total liabilities"
              value={formatINR(data.totalLiabilities)}
            />
            <StatCard label="Equity" value={formatINR(data.totalEquity)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section
              title="Assets"
              lines={data.assets}
              total={data.totalAssets}
              totalLabel="Total assets"
            />
            <div className="flex flex-col gap-4">
              <Section
                title="Liabilities"
                lines={data.liabilities}
                total={data.totalLiabilities}
                totalLabel="Total liabilities"
              />
              <Section
                title="Equity"
                lines={data.equity}
                total={data.totalEquity}
                totalLabel="Total equity"
              />
            </div>
          </div>
        </>
      ) : null}
    </ReportShell>
  );
}
