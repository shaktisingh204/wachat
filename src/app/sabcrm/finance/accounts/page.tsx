/**
 * SabCRM Finance — Chart of accounts (`/sabcrm/finance/accounts`), 20ui.
 *
 * Server entry: lists the active project's ledger heads through the
 * gated `listSabcrmChartOfAccounts` action (crate
 * `crm-chart-of-accounts`, `/v1/sabcrm/finance/accounts`). Rows are
 * grouped by account type server-side (asset → liability → income →
 * expense → equity) and rendered via the shared
 * {@link FinanceLedgerClient} ("grouped list" simplification — a full
 * parent/child tree is a follow-up; `parentId` is round-tripped by the
 * crate but the dialog doesn't expose it yet).
 */

import * as React from 'react';

import { listSabcrmChartOfAccounts } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chart of accounts — SabCRM Finance',
};

const TYPE_LABEL: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  income: 'Income',
  expense: 'Expense',
  equity: 'Equity',
};

/** Statement-conventional ordering for the grouped list. */
const TYPE_ORDER: Record<string, number> = {
  asset: 0,
  liability: 1,
  income: 2,
  expense: 3,
  equity: 4,
};

export default async function SabcrmFinanceAccountsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmChartOfAccounts({ limit: 100 });

  const docs = res.ok ? [...res.data] : [];
  docs.sort((a, b) => {
    const ta = TYPE_ORDER[a.accountType ?? ''] ?? 9;
    const tb = TYPE_ORDER[b.accountType ?? ''] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });

  const rows: LedgerRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.name,
    status: doc.status ?? 'active',
    currency: doc.currency || 'INR',
    cells: {
      name: doc.name,
      code: doc.code ?? '',
      type: TYPE_LABEL[doc.accountType ?? ''] ?? doc.accountType ?? '—',
      openingBalance: doc.openingBalance ?? 0,
    },
  }));

  return (
    <FinanceLedgerClient
      kind="accounts"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
