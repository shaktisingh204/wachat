import React, { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { listPayouts } from '@/app/actions/finance/payouts.actions';
import { PayoutListClient } from './_components/payouts-list-client';

export const dynamic = 'force-dynamic';

async function PayoutPageContainer() {
  const { items, error } = await listPayouts();
  
  if (error) {
    throw new Error(error);
  }

  return <PayoutListClient initialItems={items || []} />;
}

export default function PayoutPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <PayoutPageContainer  />
    </Suspense>
  );
}
