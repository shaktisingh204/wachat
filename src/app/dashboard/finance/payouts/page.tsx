import React from 'react';
import { listPayouts } from '@/app/actions/finance/payouts.actions';
import { PayoutListClient } from './_components/payouts-list-client';

export default async function PayoutPage() {
  const { items, error } = await listPayouts();

  return <PayoutListClient initialItems={items || []} error={error} />;
}
