import React, { Suspense } from 'react';
import { listInventoryItems } from '@/app/actions/finance/inventory.actions';
import { InventoryItemListClient } from './_components/inventory-list-client';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

async function InventoryItemListContainer() {
  const { items, error } = await listInventoryItems();
  return <InventoryItemListClient initialItems={items || []} error={error} />;
}

export default function InventoryItemPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <InventoryItemListContainer />
    </Suspense>
  );
}
