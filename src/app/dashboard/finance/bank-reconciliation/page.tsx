import { Suspense } from 'react';
import { listBankRecons } from '@/app/actions/finance/bank-reconciliation.actions';
import { BankReconListClient } from './_components/bank-reconciliation-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function BankReconListContainer() {
  const { items, error } = await listBankRecons();
  return <BankReconListClient initialItems={items || []} error={error} />;
}

function BankReconFallback() {
  return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

export default function BankReconPage() {
  return (
    <Suspense fallback={<BankReconFallback />}>
      <BankReconListContainer />
    </Suspense>
  );
}
