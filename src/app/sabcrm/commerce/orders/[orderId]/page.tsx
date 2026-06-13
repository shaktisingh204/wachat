/**
 * SabCRM Commerce — order detail
 * (`/sabcrm/commerce/orders/[orderId]`), 20ui.
 *
 * Server entry: fetches one order + its resolved storefront label
 * through the gated `getSabcrmStoreOrderDetail` action (crate
 * `crm-store`) and renders the DocDetailPage-based
 * {@link OrderDetailClient} with mark-paid / mark-fulfilled / cancel
 * transitions. Auth / RBAC are enforced by the parent layout + the
 * action's gate.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabcrmStoreOrderDetail } from '@/app/actions/sabcrm-commerce-orders.actions';
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
  const res = await getSabcrmStoreOrderDetail(orderId);
  if (!res.ok) {
    notFound();
  }
  return (
    <OrderDetailClient
      order={res.data.order}
      storefrontLabel={res.data.storefrontLabel}
    />
  );
}
