/**
 * SabCRM Finance — Expenses (`/sabcrm/finance/expenses`).
 *
 * Server entry for the doc-surface expense-claims vertical (spec
 * §3.12). Fetches page 1 of display-ready rows (employee labels
 * resolved server-side — no ObjectIds reach the client) plus the KPI
 * strip in parallel through the gated actions. Parses `searchParams`
 * (`q`, `status`, `partyId`, `from`, `to`) into the kit's
 * `initialFilters` so statement drill-downs (P&L / cash-flow expense
 * claims) deep-link into a filtered list.
 *
 * NB: crate `crm-expense-claims` is snake_case on the wire and its
 * pages are 0-indexed — both traps are owned by the actions file.
 */

import * as React from 'react';

import {
  getSabcrmExpenseKpis,
  listSabcrmExpensesPage,
} from '@/app/actions/sabcrm-finance-expenses.actions';
import type { CrmExpenseClaimStatus } from '@/lib/rust-client/crm-expense-claims';
import { ExpensesClient } from './expenses-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Expenses — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceExpensesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmExpensesPage({
      page: 1,
      q: q || undefined,
      status: (status as CrmExpenseClaimStatus | '') || '',
      employeeId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmExpenseKpis(),
  ]);

  return (
    <ExpensesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
    />
  );
}
