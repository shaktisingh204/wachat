/**
 * SabCRM Finance — Bills (`/sabcrm/finance/bills`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec §3.6).
 * Fetches page 1 of display-ready rows (vendor labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client.
 *
 * Deep links: `?q= / ?status= / ?partyId= / ?from= / ?to=` seed the
 * toolbar filters AND the initial fetch (statements drill-down, §1.4) —
 * `partyId` filters by vendor.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmBillKpis,
  listSabcrmBillsPage,
} from '@/app/actions/sabcrm-finance-bills.actions';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';
import { BillsClient } from './bills-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bills — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceBillsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmBillStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmBillsPage({
      page: 1,
      q: q || undefined,
      status,
      vendorId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmBillKpis(),
  ]);

  return (
    <BillsClient
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
