/**
 * SabCRM Commerce — POS holds (`/sabcrm/commerce/pos-holds`), 20ui.
 *
 * Server entry for the doc-surface POS-hold vertical. Fetches page 1
 * of display-ready rows (session + customer labels resolved
 * server-side, cart value rolled up) plus the KPI strip in parallel,
 * then hands everything to the kit-driven client. `?q= / ?status=`
 * seed the toolbar; an engine outage normalises into the kit's inline
 * error state.
 */

import * as React from 'react';

import {
  getSabcrmPosHoldKpis,
  listSabcrmPosHoldsPage,
} from '@/app/actions/sabcrm-commerce-pos-holds.actions';
import type { CrmPosHoldStatus } from '@/lib/rust-client/crm-pos';
import { PosHoldsClient } from './pos-holds-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS holds — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommercePosHoldsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmPosHoldStatus | '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPosHoldsPage({ page: 1, q: q || undefined, status }),
    getSabcrmPosHoldKpis(),
  ]);

  return (
    <PosHoldsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
