/**
 * SabCRM Finance — Expenses (`/sabcrm/finance/expenses`).
 *
 * Server entry for the doc-surface expense-claims vertical (spec
 * §3.12). Fetches page 1 of display-ready rows (employee labels
 * resolved server-side — no ObjectIds reach the client) plus the KPI
 * strip in parallel through the gated actions.
 *
 * NB: crate `crm-expense-claims` is snake_case on the wire and its
 * pages are 0-indexed — both traps are owned by the actions file.
 */

import * as React from 'react';

import {
  getSabcrmExpenseKpis,
  listSabcrmExpensesPage,
} from '@/app/actions/sabcrm-finance-expenses.actions';
import { ExpensesClient } from './expenses-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Expenses — SabCRM Finance',
};

export default async function SabcrmFinanceExpensesPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmExpensesPage({ page: 1 }),
    getSabcrmExpenseKpis(),
  ]);

  return (
    <ExpensesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
