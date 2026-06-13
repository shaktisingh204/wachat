/**
 * SabCRM Commerce — Coupons (`/sabcrm/commerce/coupons`), 20ui.
 *
 * Server entry for the doc-surface coupon vertical. Fetches page 1 of
 * full-field rows (applicable-product labels resolved server-side — no
 * ObjectIds reach the client) plus the KPI strip in parallel through
 * the gated actions, then hands everything to the kit-driven client.
 *
 * Deep links: `?q= / ?status=` seed the toolbar + initial fetch;
 * `?edit=<id>` opens the edit drawer client-side. Auth / RBAC are
 * enforced by the parent layout + every action's gate; an engine
 * outage normalises into the kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmCouponKpis,
  listSabcrmCouponsPage,
} from '@/app/actions/sabcrm-commerce-coupons.actions';
import type { CrmCouponStatus } from '@/lib/rust-client/crm-coupons';
import { CouponsClient } from './coupons-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Coupons — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommerceCouponsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmCouponStatus | '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmCouponsPage({ page: 1, q: q || undefined, status }),
    getSabcrmCouponKpis(),
  ]);

  return (
    <CouponsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
