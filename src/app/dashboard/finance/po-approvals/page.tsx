import React, { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { listPurchaseOrders } from '@/app/actions/finance/po-approvals.actions';
import { PurchaseOrderListClient } from './_components/po-approvals-list-client';

export const dynamic = 'force-dynamic';

async function PurchaseOrderPageContainer() {
  const { items, error } = await listPurchaseOrders();
  
  if (error) {
    throw new Error(error);
  }

  return <PurchaseOrderListClient initialItems={items || []} />;
}

export default function PurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <PurchaseOrderPageContainer  />
    </Suspense>
  );
}
