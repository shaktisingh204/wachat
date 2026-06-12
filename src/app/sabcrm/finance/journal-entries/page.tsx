/**
 * SabCRM Finance — Journal entries (`/sabcrm/finance/journal-entries`),
 * 20ui.
 *
 * Server entry: lists the active project's voucher entries through the
 * gated `listSabcrmJournalEntries` action (crate `crm-voucher-entries`,
 * `/v1/sabcrm/finance/journal-entries`) and feeds the chart of accounts
 * into the create dialog's debit/credit selects. The dialog posts a
 * simple 2-line balanced entry; multi-line entries remain a follow-up
 * (the crate already supports them).
 */

import * as React from 'react';

import {
  listSabcrmJournalEntries,
  listSabcrmChartOfAccounts,
} from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceJournalClient,
  type JournalAccountOption,
  type JournalRow,
} from '../_components/finance-journal-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Journal entries — SabCRM Finance',
};

export default async function SabcrmFinanceJournalEntriesPage(): Promise<React.JSX.Element> {
  const [entriesRes, accountsRes] = await Promise.all([
    listSabcrmJournalEntries({ limit: 100 }),
    listSabcrmChartOfAccounts({ limit: 100 }),
  ]);

  const accountById = new Map<string, string>();
  const accounts: JournalAccountOption[] = accountsRes.ok
    ? accountsRes.data.map((a) => {
        accountById.set(a._id, a.name);
        return { id: a._id, name: a.name, accountType: a.accountType };
      })
    : [];

  const rows: JournalRow[] = entriesRes.ok
    ? entriesRes.data.map((doc) => {
        const debits = doc.debitEntries ?? [];
        const credits = doc.creditEntries ?? [];
        const linesSummary =
          debits.length === 1 && credits.length === 1
            ? `${accountById.get(debits[0].accountId) ?? 'Account'} → ${
                accountById.get(credits[0].accountId) ?? 'Account'
              }`
            : `${debits.length} dr / ${credits.length} cr`;
        return {
          id: doc._id,
          voucherNumber: doc.voucherNumber,
          date: doc.date,
          narration: doc.narration ?? '',
          linesSummary,
          totalDebit: doc.totalDebit ?? 0,
          totalCredit: doc.totalCredit ?? 0,
          status: doc.status ?? 'posted',
        };
      })
    : [];

  return (
    <FinanceJournalClient
      initialRows={rows}
      accounts={accounts}
      initialError={entriesRes.ok ? null : entriesRes.error}
    />
  );
}
