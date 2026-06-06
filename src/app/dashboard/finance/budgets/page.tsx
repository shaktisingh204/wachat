import React, { Suspense } from 'react';
import { listBudgets } from '@/app/actions/finance/budgets.actions';
import { BudgetListClient } from './_components/budgets-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function BudgetListContainer() {
  const { items, error } = await listBudgets();
  return <BudgetListClient initialItems={items || []} error={error} />;
}

export default function BudgetPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-8">
          <Skeleton height={40} width="100%" radius="var(--st-radius)" />
          <Skeleton height={400} width="100%" radius="var(--st-radius)" />
        </div>
      }
    >
      <BudgetListContainer />
    </Suspense>
  );
}
