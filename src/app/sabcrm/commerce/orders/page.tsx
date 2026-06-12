/**
 * SabCRM Commerce — Orders (`/sabcrm/commerce/orders`), 20ui.
 *
 * Server entry: lists the active project's storefront orders through
 * the gated `listSabcrmStoreOrders` action (crate `crm-store`,
 * `/v1/sabcrm/commerce/store/orders`). The badge column is the PAYMENT
 * status; fulfilment renders as text. Each row links to the
 * detail-lite page at `/sabcrm/commerce/orders/[orderId]`.
 */

import * as React from 'react';

import { listSabcrmStoreOrders } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Orders — SabCRM Commerce',
};

const FULFILLMENT_LABEL: Record<string, string> = {
  unfulfilled: 'Unfulfilled',
  partial: 'Partial',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export default async function SabcrmCommerceOrdersPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmStoreOrders({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.orderNumber,
    status: doc.paymentStatus,
    currency: doc.currency || 'INR',
    cells: {
      orderNumber: doc.orderNumber,
      placedAt: doc.placedAt,
      customerName: doc.customerName,
      total: doc.total,
      fulfillment:
        FULFILLMENT_LABEL[doc.fulfillmentStatus] ?? doc.fulfillmentStatus,
    },
  }));

  return (
    <CommerceClient
      kind="orders"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
