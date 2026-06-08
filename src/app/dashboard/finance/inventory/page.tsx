import { Suspense } from 'react';
import { listInventoryItems } from '@/app/actions/finance/inventory.actions';
import { InventoryItemListClient } from './_components/inventory-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function InventoryItemListContainer() {
  const { items, error } = await listInventoryItems();
  return <InventoryItemListClient initialItems={items || []} error={error} />;
}

function InventoryItemFallback() {
  return (
    <div className="20ui flex w-full flex-col gap-4 p-8">
      <Skeleton height={40} width="100%" />
      <Skeleton height={400} width="100%" />
    </div>
  );
}

export default function InventoryItemPage() {
  return (
    <Suspense fallback={<InventoryItemFallback />}>
      <InventoryItemListContainer />
    </Suspense>
  );
}
