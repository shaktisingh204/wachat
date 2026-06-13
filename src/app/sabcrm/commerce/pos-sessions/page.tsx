/**
 * SabCRM Commerce — POS sessions (`/sabcrm/commerce/pos-sessions`), 20ui.
 *
 * Server entry for the doc-surface POS-session vertical. Fetches page 1
 * of display-ready rows plus the KPI strip in parallel through the
 * gated actions, then hands everything to the kit-driven client (with
 * the "Open session" dialog). `?q= / ?status=` seed the toolbar; an
 * engine outage normalises into the kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmPosSessionKpis,
  listSabcrmPosSessionsPage,
} from '@/app/actions/sabcrm-commerce-pos-sessions.actions';
import type { CrmPosSessionStatus } from '@/lib/rust-client/crm-pos';
import { PosSessionsClient } from './pos-sessions-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS sessions — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommercePosSessionsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmPosSessionStatus | '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPosSessionsPage({ page: 1, q: q || undefined, status }),
    getSabcrmPosSessionKpis(),
  ]);

  return (
    <PosSessionsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
