import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
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

function PurchaseOrderPageFallback() {
  return (
    <div className="space-y-4 p-8">
      <Skeleton height={40} width="100%" />
      <Skeleton height={400} width="100%" />
    </div>
  );
}

export default function PurchaseOrderPage() {
  return (
    <Suspense fallback={<PurchaseOrderPageFallback />}>
      <PurchaseOrderPageContainer />
    </Suspense>
  );
}
