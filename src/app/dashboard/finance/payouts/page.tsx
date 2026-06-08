import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
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

function PayoutPageFallback() {
  return (
    <div className="20ui space-y-4 p-8">
      <Skeleton height={40} width="100%" radius="var(--st-radius)" />
      <Skeleton height={400} width="100%" radius="var(--st-radius)" />
    </div>
  );
}

export default function PayoutPage() {
  return (
    <Suspense fallback={<PayoutPageFallback />}>
      <PayoutPageContainer />
    </Suspense>
  );
}
