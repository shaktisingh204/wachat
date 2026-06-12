/**
 * SabCRM Finance — Balance sheet (`/sabcrm/finance/balance-sheet`),
 * read-only 20ui report.
 *
 * Server-rendered over `getSabcrmBalanceSheet`: cash (receipts −
 * payouts − expenses), accounts receivable (open invoice balances),
 * accounts payable (open bill balances), with retained earnings as the
 * derived balancing figure.
 *
 * Statements enrichment (finance-rollout §4):
 *   - `?asOf=YYYY-MM-DD` month-end switcher excludes documents dated
 *     after the cut-off (AR/AP balances stay current-state — noted).
 *   - AR drills into open/overdue invoices, AP into open bills, cash
 *     into receipts/payouts.
 *   - CSV export + print.
 */

import * as React from 'react';

import { Card, CardBody, CardHeader, CardTitle, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmBalanceSheet } from '@/app/actions/sabcrm-statements.actions';
import {
  DrillLink,
  formatINR,
  formatReportDate,
  lastFyEnd,
  PeriodSwitcher,
  recentMonthEnds,
  ReportShell,
} from '../_components/finance-report';
import {
  StatementExportButton,
  StatementPrintButton,
} from '../_components/statement-export-button';
import type { SabcrmBalanceSheetLine } from '@/app/actions/sabcrm-statements.actions.types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Balance sheet — SabCRM Finance',
};

/** Drill-down links per derived line (label-keyed; v1 derivations). */
const LINE_LINKS: Record<string, Array<{ label: string; href: string }>> = {
  'Cash & bank': [
    { label: 'Receipts', href: '/sabcrm/finance/payment-receipts' },
    { label: 'Payouts', href: '/sabcrm/finance/payouts' },
  ],
  'Accounts receivable': [
    { label: 'Open invoices', href: '/sabcrm/finance/invoices' },
    { label: 'Overdue', href: '/sabcrm/finance/invoices?status=overdue' },
  ],
  'Accounts payable': [
    { label: 'Open bills', href: '/sabcrm/finance/bills' },
    { label: 'Overdue', href: '/sabcrm/finance/bills?status=overdue' },
  ],
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
            {lines.map((line) => {
              const links = LINE_LINKS[line.label];
              return (
                <Tr key={line.label}>
                  <Td>
                    {line.label}
                    {line.note ? (
                      <span className="block text-xs text-[var(--ui20-color-text-muted,#6b7280)]">
                        {line.note}
                      </span>
                    ) : null}
                    {links ? (
                      <span className="fin-cell-links">
                        {links.map((l, i) => (
                          <React.Fragment key={l.href}>
                            {i > 0 ? ' · ' : null}
                            <DrillLink href={l.href}>{l.label}</DrillLink>
                          </React.Fragment>
                        ))}
                      </span>
                    ) : null}
                  </Td>
                  <Td align="right">{formatINR(line.amount)}</Td>
                </Tr>
              );
            })}
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

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PageProps {
  searchParams: Promise<{ asOf?: string }>;
}

export default async function SabcrmBalanceSheetPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const asOf =
    params.asOf && DAY_KEY_RE.test(params.asOf) ? params.asOf : undefined;

  const res = await getSabcrmBalanceSheet(asOf);
  const data = res.ok ? res.data : null;

  const monthEnds = recentMonthEnds(6);
  const fyEnd = lastFyEnd();
  const asOfDays = monthEnds.includes(fyEnd)
    ? monthEnds
    : [...monthEnds, fyEnd];
  const asOfLinks = [
    { label: 'Today', href: '/sabcrm/finance/balance-sheet', active: !asOf },
    ...asOfDays.map((day) => ({
      label:
        day === fyEnd
          ? `FY end · ${formatReportDate(day)}`
          : formatReportDate(day),
      href: `/sabcrm/finance/balance-sheet?asOf=${day}`,
      active: asOf === day,
    })),
  ];

  const csvRows = data
    ? [
        ...data.assets.map((l) => ({
          Section: 'Assets',
          Line: l.label,
          Amount: l.amount,
          Note: l.note ?? '',
        })),
        { Section: 'Assets', Line: 'Total assets', Amount: data.totalAssets, Note: '' },
        ...data.liabilities.map((l) => ({
          Section: 'Liabilities',
          Line: l.label,
          Amount: l.amount,
          Note: l.note ?? '',
        })),
        {
          Section: 'Liabilities',
          Line: 'Total liabilities',
          Amount: data.totalLiabilities,
          Note: '',
        },
        ...data.equity.map((l) => ({
          Section: 'Equity',
          Line: l.label,
          Amount: l.amount,
          Note: l.note ?? '',
        })),
        { Section: 'Equity', Line: 'Total equity', Amount: data.totalEquity, Note: '' },
      ]
    : [];

  return (
    <ReportShell
      title="Balance sheet"
      description="Assets vs liabilities & equity for this workspace — part of the SabCRM Finance suite."
      actions={
        <>
          <PeriodSwitcher links={asOfLinks} label="As-of date" />
          <StatementExportButton
            rows={csvRows}
            fileName={`balance-sheet-${(data?.asOf ?? new Date().toISOString()).slice(0, 10)}.csv`}
          />
          <StatementPrintButton />
        </>
      }
      error={res.ok ? null : res.error}
      methodology="Simplified statement over the workspace's finance documents: cash = payment receipts − payouts − approved expenses; receivable/payable = unpaid balances on open invoices/bills; retained earnings is the balancing figure (assets − liabilities), so the sheet always ties. With an as-of date, documents dated after the cut-off are excluded, but AR/AP open balances remain today's values (paid-to-date is not re-wound). Fixed assets, loans and tax provisions are not yet modelled."
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
