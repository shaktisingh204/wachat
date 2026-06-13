/**
 * SabCRM Supply — Bills of material (`/sabcrm/supply/bom`, rollout WI-10).
 *
 * Server entry: page 1 of list rows + the KPI strip in parallel through
 * the gated actions, then the kit-driven client.
 */

import * as React from 'react';

import {
  getSabcrmSupplyBomKpis,
  listSabcrmSupplyBomsPage,
} from '@/app/actions/sabcrm-supply-bom.actions';
import type { SabcrmBomStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { BomClient } from './bom-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bills of material — SabCRM Supply',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmSupplyBomPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as SabcrmBomStatus | '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmSupplyBomsPage({
      page: 1,
      q: q || undefined,
      status,
      from,
      to,
    }),
    getSabcrmSupplyBomKpis(),
  ]);

  return (
    <BomClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || from || to ? { q, status, from, to } : undefined
      }
    />
  );
}
