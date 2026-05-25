import React, { Suspense } from 'react';
import { ClientPage } from './client-page';
import { getExpenseClaims } from '@/app/actions/hrm-advanced/expense-policy';
import { Skeleton } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';


// Next.js config for the page
export const metadata = {
  title: 'Expense Policy | SabNode CRM',
  description: 'Manage and approve employee expenses with real-time updates.',
};

export default async function ExpensePolicyPage() {
  return (
    <Suspense fallback={<ExpensePolicySkeleton />}>
      <ExpensePolicyDataFetcher />
    </Suspense>
  );
}

async function ExpensePolicyDataFetcher() {
  const data = await getExpenseClaims();
  return <ClientPage initialData={data || []} />;
}

function ExpensePolicySkeleton() {
  return (
    <EntityListShell
      title="Expense Policy Engine"
      subtitle="Manage, filter, and approve employee expenses with real-time updates."
      loading={true}
    >
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </EntityListShell>
  );
}
