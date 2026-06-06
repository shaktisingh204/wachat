import React, { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { listSubscriptions } from '@/app/actions/finance/subscriptions.actions';
import { SubscriptionListClient } from './_components/subscriptions-list-client';

export const dynamic = 'force-dynamic';

async function SubscriptionPageContainer() {
  const { items, error } = await listSubscriptions();

  return <SubscriptionListClient initialItems={items || []} error={error} />;
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <SubscriptionPageContainer  />
    </Suspense>
  );
}
