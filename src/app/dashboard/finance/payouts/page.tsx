import React from 'react';
import { listPayouts } from '@/app/actions/finance/payouts.actions';
import { PayoutListClient } from './_components/payouts-list-client';

export default async function PayoutPage() {
  const { items, error } = await listPayouts();
  
  if (error) {
    throw new Error(error);
  }

  return <PayoutListClient initialItems={items || []} />;
}
