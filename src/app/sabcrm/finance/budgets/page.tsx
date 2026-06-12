/**
 * SabCRM Finance — Budgets (`/sabcrm/finance/budgets`).
 *
 * Server entry for the doc-surface budgets vertical (spec §3.16).
 * Fetches page 1 of display-ready rows plus the KPI strip in parallel
 * through the gated actions.
 *
 * NB: crate `crm-budgets` pages are 0-indexed and its entity wire
 * carries extended JSON — both traps are owned by the actions file.
 */

import * as React from 'react';

import {
  getSabcrmBudgetKpis,
  listSabcrmBudgetsPage,
} from '@/app/actions/sabcrm-finance-budgets.actions';
import { BudgetsClient } from './budgets-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Budgets — SabCRM Finance',
};

export default async function SabcrmFinanceBudgetsPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmBudgetsPage({ page: 1 }),
    getSabcrmBudgetKpis(),
  ]);

  return (
    <BudgetsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
