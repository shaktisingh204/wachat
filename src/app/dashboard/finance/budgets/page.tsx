import React from 'react';
import { listBudgets } from '@/app/actions/finance/budgets.actions';
import { BudgetListClient } from './_components/budgets-list-client';

export default async function BudgetPage() {
  const { items, error } = await listBudgets();

  return <BudgetListClient initialItems={items || []} error={error} />;
}
