/**
 * SabCRM Commerce — Orders (`/sabcrm/commerce/orders`), 20ui.
 *
 * Server entry for the doc-surface order vertical. Fetches page 1 of
 * display-ready rows (storefront labels resolved server-side — no
 * ObjectIds reach the client) plus the KPI strip in parallel through
 * the gated actions, then hands everything to the kit-driven client.
 * The kit `status` column is the PAYMENT status; fulfilment renders as
 * a badge column. `?q= / ?status= / ?partyId= / ?from= / ?to=` seed
 * the toolbar + initial fetch; an engine outage normalises into the
 * kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmStoreOrderKpis,
  listSabcrmStoreOrdersPage,
} from '@/app/actions/sabcrm-commerce-orders.actions';
import type { CrmStoreOrderPaymentStatus } from '@/lib/rust-client/crm-store';
import { OrdersClient } from './orders-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Orders — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommerceOrdersPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmStoreOrderPaymentStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmStoreOrdersPage({
      page: 1,
      q: q || undefined,
      status,
      storefrontId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmStoreOrderKpis(),
  ]);

  return (
    <OrdersClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
    />
  );
}
