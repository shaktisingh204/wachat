/**
 * SabCRM Commerce — POS transactions
 * (`/sabcrm/commerce/pos-transactions`), 20ui.
 *
 * Server entry for the doc-surface POS-transaction vertical. Fetches
 * page 1 of display-ready rows (session + customer labels resolved
 * server-side) plus the KPI strip in parallel, then hands everything
 * to the kit-driven client. `?q= / ?status= / ?partyId=(sessionId) /
 * ?from= / ?to=` seed the toolbar; an engine outage normalises into
 * the kit's inline error state.
 */

import * as React from 'react';

import {
  getSabcrmPosTransactionKpis,
  listSabcrmPosTransactionsPage,
} from '@/app/actions/sabcrm-commerce-pos-transactions.actions';
import { PosTransactionsClient } from './pos-transactions-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS transactions — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommercePosTransactionsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPosTransactionsPage({
      page: 1,
      q: q || undefined,
      status,
      sessionId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmPosTransactionKpis(),
  ]);

  return (
    <PosTransactionsClient
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
