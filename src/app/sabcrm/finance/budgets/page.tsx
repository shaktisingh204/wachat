/**
 * SabCRM Finance — Budgets (`/sabcrm/finance/budgets`), 20ui.
 *
 * Server entry: lists the active project's budgets through the gated
 * `listSabcrmBudgets` action (crate `crm-budgets`,
 * `/v1/sabcrm/finance/budgets`). Renders via the shared
 * {@link FinanceLedgerClient}.
 */

import * as React from 'react';

import { listSabcrmBudgets } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Budgets — SabCRM Finance',
};

export default async function SabcrmFinanceBudgetsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmBudgets();

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: doc.budgetHead,
        status: doc.status ?? 'draft',
        currency: doc.currency ?? 'INR',
        cells: {
          budgetHead: doc.budgetHead,
          department: doc.department ?? '',
          period: doc.period ?? '',
          plannedAmount: doc.plannedAmount,
          actualAmount: doc.actualAmount ?? 0,
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="budgets"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
