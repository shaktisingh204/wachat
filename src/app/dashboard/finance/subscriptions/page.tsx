import React, { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { listSubscriptions } from '@/app/actions/finance/subscriptions.actions';
import { SubscriptionListClient } from './_components/subscriptions-list-client';

export const dynamic = 'force-dynamic';

async function SubscriptionPageContainer() {
  const { items, error } = await listSubscriptions();

  return <SubscriptionListClient initialItems={items || []} error={error} />;
}

/** Shape-matching loading placeholder that mirrors the subscriptions surface. */
function SubscriptionPageSkeleton() {
  return (
    <div className="ui20 space-y-6 p-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<SubscriptionPageSkeleton />}>
      <SubscriptionPageContainer />
    </Suspense>
  );
}
