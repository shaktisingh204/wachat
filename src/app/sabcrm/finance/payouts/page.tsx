/**
 * SabCRM Finance — Payouts (`/sabcrm/finance/payouts`).
 *
 * Server entry for the doc-surface payout vertical (spec §3.8). Fetches
 * page 1 of display-ready rows (vendor + payment-account labels
 * resolved server-side — no ObjectIds reach the client), the KPI strip
 * and the payment-account options for the create form, all in parallel
 * through the gated actions. Parses `searchParams` (`q`, `status`,
 * `partyId`, `from`, `to`) into the kit's `initialFilters` so statement
 * drill-downs (cash-flow outflow) deep-link into a filtered list.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 * The Rust engine may be down at dev time — that normalises into an
 * inline error state instead of crashing the route.
 */

import * as React from 'react';

import {
  getSabcrmPayoutKpis,
  listSabcrmPayoutsPage,
} from '@/app/actions/sabcrm-finance-payouts.actions';
import { listSabcrmPaymentAccountOptions } from '@/app/actions/sabcrm-finance-invoices.actions';
import type { CrmPayoutStatus } from '@/lib/rust-client/crm-payouts';
import { PayoutsClient } from './payouts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payouts — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinancePayoutsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes, accountsRes] = await Promise.all([
    listSabcrmPayoutsPage({
      page: 1,
      q: q || undefined,
      status: (status as CrmPayoutStatus | '') || '',
      vendorId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmPayoutKpis(),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <PayoutsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      paymentAccounts={accountsRes.ok ? accountsRes.data : []}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
    />
  );
}
