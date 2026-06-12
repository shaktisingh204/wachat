/**
 * SabCRM Finance — Trial balance (`/sabcrm/finance/trial-balance`),
 * read-only 20ui report.
 *
 * Server-rendered over `getSabcrmTrialBalance`: every chart-of-account
 * ledger head's opening balance + posted journal-entry movement, with
 * the closing balance split into Dr/Cr columns and a balance check.
 *
 * Statements enrichment (finance-rollout §4):
 *   - `?asOf=YYYY-MM-DD` month-end switcher excludes entries dated
 *     after the cut-off (last 6 month-ends + FY end + today).
 *   - Account rows drill into `/sabcrm/finance/journal-entries?q=…`
 *     (account-id precision is Rust gap G6 — name search v1).
 *   - CSV export + print (client-side, data already on the page).
 */

import * as React from 'react';

import { Badge, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmTrialBalance } from '@/app/actions/sabcrm-statements.actions';
import {
  DrillLink,
  formatINR,
  formatReportDate,
  lastFyEnd,
  PeriodSwitcher,
  recentMonthEnds,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';
import {
  StatementExportButton,
  StatementPrintButton,
} from '../_components/statement-export-button';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Trial balance — SabCRM Finance',
};

const TYPE_LABEL: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  income: 'Income',
  expense: 'Expense',
  equity: 'Equity',
};

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface PageProps {
  searchParams: Promise<{ asOf?: string }>;
}

export default async function SabcrmTrialBalancePage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const asOf =
    params.asOf && DAY_KEY_RE.test(params.asOf) ? params.asOf : undefined;

  const res = await getSabcrmTrialBalance(asOf);
  const data = res.ok ? res.data : null;

  const monthEnds = recentMonthEnds(6);
  const fyEnd = lastFyEnd();
  const asOfDays = monthEnds.includes(fyEnd)
    ? monthEnds
    : [...monthEnds, fyEnd];
  const asOfLinks = [
    { label: 'Today', href: '/sabcrm/finance/trial-balance', active: !asOf },
    ...asOfDays.map((day) => ({
      label: day === fyEnd ? `FY end · ${formatReportDate(day)}` : formatReportDate(day),
      href: `/sabcrm/finance/trial-balance?asOf=${day}`,
      active: asOf === day,
    })),
  ];

  const csvRows = (data?.rows ?? []).map((row) => ({
    Account: row.name,
    Code: row.code ?? '',
    Type: TYPE_LABEL[row.accountType ?? ''] ?? row.accountType ?? '',
    Opening: row.openingBalance,
    Debits: row.totalDebit,
    Credits: row.totalCredit,
    'Closing Dr': row.closing >= 0 ? row.closing : 0,
    'Closing Cr': row.closing < 0 ? -row.closing : 0,
  }));

  const asOfSuffix = asOf ? ` (as of ${formatReportDate(asOf)})` : '';

  return (
    <ReportShell
      title="Trial balance"
      description="Per-ledger-head debit/credit position for this workspace — part of the SabCRM Finance suite."
      actions={
        <>
          <PeriodSwitcher links={asOfLinks} label="As-of date" />
          <StatementExportButton
            rows={csvRows}
            fileName={`trial-balance${asOf ? `-${asOf}` : ''}.csv`}
          />
          <StatementPrintButton />
        </>
      }
      error={res.ok ? null : res.error}
      methodology="Derived from chart-of-account opening balances plus posted journal entries (drafts and archived entries excluded; with an as-of date, entries dated after the cut-off are excluded too). Closing = opening + debits − credits; positive closings sit in the Dr column, negative in Cr. Account rows drill into the journal-entries list by account name."
    >
      {data ? (
        data.rows.length === 0 ? (
          <ReportEmpty message="No ledger accounts yet — create accounts under Chart of accounts and post journal entries to build the trial balance." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label={`Total debit${asOfSuffix}`}
                value={formatINR(data.totalDebit)}
              />
              <StatCard label="Total credit" value={formatINR(data.totalCredit)} />
              <StatCard
                label="Balance check"
                value={
                  <Badge tone={data.balanced ? 'success' : 'danger'} dot>
                    {data.balanced ? 'Balanced' : 'Out of balance'}
                  </Badge>
                }
              />
            </div>

            <Table hover>
              <THead>
                <Tr>
                  <Th>Account</Th>
                  <Th>Code</Th>
                  <Th>Type</Th>
                  <Th align="right">Opening</Th>
                  <Th align="right">Debits</Th>
                  <Th align="right">Credits</Th>
                  <Th align="right">Dr</Th>
                  <Th align="right">Cr</Th>
                </Tr>
              </THead>
              <TBody>
                {data.rows.map((row) => (
                  <Tr key={row.accountId}>
                    <Td>
                      <DrillLink
                        href={`/sabcrm/finance/journal-entries?q=${encodeURIComponent(row.name)}`}
                        title={`Journal entries touching ${row.name}`}
                      >
                        {row.name}
                      </DrillLink>
                    </Td>
                    <Td>{row.code ?? '—'}</Td>
                    <Td>
                      {TYPE_LABEL[row.accountType ?? ''] ??
                        row.accountType ??
                        '—'}
                    </Td>
                    <Td align="right">{formatINR(row.openingBalance)}</Td>
                    <Td align="right">{formatINR(row.totalDebit)}</Td>
                    <Td align="right">{formatINR(row.totalCredit)}</Td>
                    <Td align="right">
                      {row.closing >= 0 ? formatINR(row.closing) : '—'}
                    </Td>
                    <Td align="right">
                      {row.closing < 0 ? formatINR(-row.closing) : '—'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
              <TFoot>
                <Tr>
                  <Td colSpan={6}>
                    Totals ({data.rows.length} accounts,{' '}
                    {data.entryCount} posted entries
                    {data.asOf ? ` to ${formatReportDate(data.asOf)}` : ''})
                  </Td>
                  <Td align="right">{formatINR(data.totalDebit)}</Td>
                  <Td align="right">{formatINR(data.totalCredit)}</Td>
                </Tr>
              </TFoot>
            </Table>
          </>
        )
      ) : null}
    </ReportShell>
  );
}
