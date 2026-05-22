import React from 'react';
import { listSubscriptions } from '@/app/actions/finance/subscriptions.actions';
import { SubscriptionListClient } from './_components/subscriptions-list-client';

export default async function SubscriptionPage() {
  const { items, error } = await listSubscriptions();

  return <SubscriptionListClient initialItems={items || []} error={error} />;
}
