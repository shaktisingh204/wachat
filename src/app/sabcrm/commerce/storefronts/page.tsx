/**
 * SabCRM Commerce — Storefronts (`/sabcrm/commerce/storefronts`), 20ui.
 *
 * Server entry for the doc-surface storefront vertical. Fetches page 1
 * of full-field rows (homepage blocks included so the edit drawer
 * needs no second fetch) plus the KPI strip in parallel through the
 * gated actions, then hands everything to the kit-driven client.
 *
 * `?q= / ?status=` seed the toolbar + initial fetch; `?edit=<id>`
 * opens the edit drawer client-side. An engine outage normalises into
 * the kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmStorefrontKpis,
  listSabcrmStorefrontsPage,
} from '@/app/actions/sabcrm-commerce-storefronts.actions';
import type { CrmStorefrontStatus } from '@/lib/rust-client/crm-store';
import { StorefrontsClient } from './storefronts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Storefronts — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommerceStorefrontsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmStorefrontStatus | '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmStorefrontsPage({ page: 1, q: q || undefined, status }),
    getSabcrmStorefrontKpis(),
  ]);

  return (
    <StorefrontsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
