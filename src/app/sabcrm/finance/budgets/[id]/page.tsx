/**
 * SabCRM Finance — Budget detail (`/sabcrm/finance/budgets/[id]`).
 *
 * Server entry: fetches the budget and hands it to the detail client
 * (utilisation summary, approval workflow, audit trail).
 */

import * as React from 'react';

import { getSabcrmBudgetFull } from '@/app/actions/sabcrm-finance-budgets.actions';
import { BudgetDetailClient } from './budget-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Budget — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceBudgetDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const budgetRes = await getSabcrmBudgetFull(id);

  return (
    <BudgetDetailClient
      budget={budgetRes.ok ? budgetRes.data : null}
      error={budgetRes.ok ? null : budgetRes.error}
    />
  );
}
