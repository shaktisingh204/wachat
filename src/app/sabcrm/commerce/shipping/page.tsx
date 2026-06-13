/**
 * SabCRM Commerce — Shipping zones (`/sabcrm/commerce/shipping`), 20ui.
 *
 * Server entry for the doc-surface shipping vertical. Fetches page 1
 * of full-field rows (methods grid included so the edit drawer needs
 * no second fetch; storefront labels resolved server-side) plus the
 * KPI strip in parallel, then hands everything to the kit-driven
 * client. `?q= / ?status= / ?partyId=(storefrontId)` seed the toolbar;
 * `?edit=<id>` opens the drawer; an engine outage normalises into the
 * kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmShippingZoneKpis,
  listSabcrmShippingZonesPage,
} from '@/app/actions/sabcrm-commerce-shipping.actions';
import type { CrmStoreShippingZoneStatus } from '@/lib/rust-client/crm-store';
import { ShippingClient } from './shipping-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shipping zones — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommerceShippingPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmStoreShippingZoneStatus | '';
  const partyId = first(params.partyId) ?? '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmShippingZonesPage({
      page: 1,
      q: q || undefined,
      status,
      storefrontId: partyId || undefined,
    }),
    getSabcrmShippingZoneKpis(),
  ]);

  return (
    <ShippingClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
