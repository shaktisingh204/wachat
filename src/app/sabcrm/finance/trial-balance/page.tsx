/**
 * SabCRM Finance — Trial balance (`/sabcrm/finance/trial-balance`),
 * read-only 20ui report.
 *
 * Server-rendered over `getSabcrmTrialBalance`: every chart-of-account
 * ledger head's opening balance + posted journal-entry movement, with
 * the closing balance split into Dr/Cr columns and a balance check.
 */

import * as React from 'react';

import { Badge, StatCard, Table, TBody, Td, TFoot, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { getSabcrmTrialBalance } from '@/app/actions/sabcrm-statements.actions';
import {
  formatINR,
  ReportEmpty,
  ReportShell,
} from '../_components/finance-report';

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

export default async function SabcrmTrialBalancePage(): Promise<React.JSX.Element> {
  const res = await getSabcrmTrialBalance();
  const data = res.ok ? res.data : null;

  return (
    <ReportShell
      title="Trial balance"
      description="Per-ledger-head debit/credit position for this workspace — part of the SabCRM Finance suite."
      error={res.ok ? null : res.error}
      methodology="Derived from chart-of-account opening balances plus posted journal entries (drafts and archived entries excluded). Closing = opening + debits − credits; positive closings sit in the Dr column, negative in Cr."
    >
      {data ? (
        data.rows.length === 0 ? (
          <ReportEmpty message="No ledger accounts yet — create accounts under Chart of accounts and post journal entries to build the trial balance." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Total debit" value={formatINR(data.totalDebit)} />
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
                    <Td>{row.name}</Td>
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
                    {data.entryCount} posted entries)
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
