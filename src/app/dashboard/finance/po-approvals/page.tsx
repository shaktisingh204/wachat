import React from 'react';
import { listPurchaseOrders } from '@/app/actions/finance/po-approvals.actions';
import { PurchaseOrderListClient } from './_components/po-approvals-list-client';

export default async function PurchaseOrderPage() {
  const { items, error } = await listPurchaseOrders();
  
  if (error) {
    throw new Error(error);
  }

  return <PurchaseOrderListClient initialItems={items || []} />;
}
