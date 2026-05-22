import React from 'react';
import { getAbandonedCarts } from '@/app/actions/marketing/cart-abandonment.actions';
import { AbandonedCartClient } from './_cart-abandonment-client';

export default async function AbandonedCartPage() {
  const data = await getAbandonedCarts();
  
  return <AbandonedCartClient initialData={data} />;
}
