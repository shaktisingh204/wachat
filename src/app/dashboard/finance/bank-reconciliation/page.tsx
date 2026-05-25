import React, { Suspense } from 'react';
import { listBankRecons } from '@/app/actions/finance/bank-reconciliation.actions';
import { BankReconListClient } from './_components/bank-reconciliation-list-client';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

async function BankReconListContainer() {
  const { items, error } = await listBankRecons();
  return <BankReconListClient initialItems={items || []} error={error} />;
}

export default function BankReconPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <BankReconListContainer />
    </Suspense>
  );
}
