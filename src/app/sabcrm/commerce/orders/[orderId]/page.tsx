/**
 * SabCRM Commerce — order detail-lite
 * (`/sabcrm/commerce/orders/[orderId]`), 20ui.
 *
 * Server entry: fetches one order through the gated
 * `getSabcrmStoreOrder` action (crate `crm-store`,
 * `GET /v1/sabcrm/commerce/store/orders/{orderId}`) and renders the
 * {@link OrderDetailClient} with mark-paid / mark-fulfilled actions.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabcrmStoreOrder } from '@/app/actions/sabcrm-commerce.actions';
import { OrderDetailClient } from './order-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Order — SabCRM Commerce',
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function SabcrmCommerceOrderDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { orderId } = await params;
  const res = await getSabcrmStoreOrder(orderId);
  if (!res.ok) {
    notFound();
  }
  return <OrderDetailClient order={res.data} />;
}
