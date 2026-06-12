/**
 * SabCRM Finance — Payouts (`/sabcrm/finance/payouts`).
 *
 * Server entry for the doc-surface payout vertical (spec §3.8). Fetches
 * page 1 of display-ready rows (vendor + payment-account labels
 * resolved server-side — no ObjectIds reach the client), the KPI strip
 * and the payment-account options for the create form, all in parallel
 * through the gated actions.
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
import { PayoutsClient } from './payouts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payouts — SabCRM Finance',
};

export default async function SabcrmFinancePayoutsPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes, accountsRes] = await Promise.all([
    listSabcrmPayoutsPage({ page: 1 }),
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
    />
  );
}
