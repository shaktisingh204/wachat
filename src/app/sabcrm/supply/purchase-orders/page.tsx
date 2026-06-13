/**
 * SabCRM Supply — Purchase orders (`/sabcrm/supply/purchase-orders`).
 *
 * Server entry for the supply flagship doc-surface vertical (rollout
 * WI-5). Fetches page 1 of display-ready rows (vendor labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client.
 *
 * Deep links: `?q= / ?status= / ?partyId= / ?from= / ?to=` seed the
 * toolbar filters AND the initial fetch.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 * The Rust engine may be down at dev time — that normalises into an
 * inline error state instead of crashing the route.
 */

import * as React from 'react';

import {
  getSabcrmSupplyPurchaseOrderKpis,
  listSabcrmSupplyPurchaseOrdersPage,
} from '@/app/actions/sabcrm-supply-purchase-orders.actions';
import type { SabcrmPoStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { PurchaseOrdersClient } from './purchase-orders-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Purchase orders — SabCRM Supply',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmSupplyPurchaseOrdersPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as SabcrmPoStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmSupplyPurchaseOrdersPage({
      page: 1,
      q: q || undefined,
      status,
      vendorId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmSupplyPurchaseOrderKpis(),
  ]);

  return (
    <PurchaseOrdersClient
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
