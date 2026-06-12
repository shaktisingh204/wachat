/**
 * SabCRM Finance — Quotations (`/sabcrm/finance/quotations`).
 *
 * Server entry for the doc-surface quotation vertical (finance-rollout
 * spec §3.1). Fetches page 1 of display-ready rows (party labels
 * resolved server-side — no ObjectIds reach the client) plus the KPI
 * strip in parallel through the gated actions, then hands everything to
 * the kit-driven client.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 * The Rust engine may be down at dev time — that normalises into an
 * inline error state instead of crashing the route.
 */

import * as React from 'react';

import {
  getSabcrmQuotationKpis,
  listSabcrmQuotationsPage,
} from '@/app/actions/sabcrm-finance-quotations.actions';
import { QuotationsClient } from './quotations-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quotations — SabCRM Finance',
};

export default async function SabcrmFinanceQuotationsPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmQuotationsPage({ page: 1 }),
    getSabcrmQuotationKpis(),
  ]);

  return (
    <QuotationsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
