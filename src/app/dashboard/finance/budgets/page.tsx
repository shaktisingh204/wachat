import React, { Suspense } from 'react';
import { listBudgets } from '@/app/actions/finance/budgets.actions';
import { BudgetListClient } from './_components/budgets-list-client';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

async function BudgetListContainer() {
  const { items, error } = await listBudgets();
  return <BudgetListClient initialItems={items || []} error={error} />;
}

export default function BudgetPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <BudgetListContainer />
    </Suspense>
  );
}
