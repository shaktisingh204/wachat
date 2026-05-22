import React from 'react';
import { listInventoryItems } from '@/app/actions/finance/inventory.actions';
import { InventoryItemListClient } from './_components/inventory-list-client';

export default async function InventoryItemPage() {
  const { items, error } = await listInventoryItems();

  return <InventoryItemListClient initialItems={items || []} error={error} />;
}
