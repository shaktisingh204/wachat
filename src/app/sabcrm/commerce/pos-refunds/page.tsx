/**
 * SabCRM Commerce — POS refunds (`/sabcrm/commerce/pos-refunds`), 20ui.
 *
 * Server entry for the doc-surface POS-refund vertical. Fetches page 1
 * of display-ready rows (original transaction numbers resolved
 * server-side) plus the KPI strip in parallel, then hands everything
 * to the kit-driven client. `?q= / ?status=` seed the toolbar; an
 * engine outage normalises into the kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmPosRefundKpis,
  listSabcrmPosRefundsPage,
} from '@/app/actions/sabcrm-commerce-pos-refunds.actions';
import type { SabcrmPosRefundUiStatus } from '@/app/actions/sabcrm-commerce-docs.actions.types';
import { PosRefundsClient } from './pos-refunds-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS refunds — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommercePosRefundsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as SabcrmPosRefundUiStatus | '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPosRefundsPage({ page: 1, q: q || undefined, status }),
    getSabcrmPosRefundKpis(),
  ]);

  return (
    <PosRefundsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
