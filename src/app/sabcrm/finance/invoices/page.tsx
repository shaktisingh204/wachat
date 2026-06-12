/**
 * SabCRM Finance — Invoices (`/sabcrm/finance/invoices`).
 *
 * Server entry for the flagship doc-surface vertical. Fetches page 1 of
 * display-ready rows (party labels resolved server-side — no ObjectIds
 * reach the client) plus the KPI strip in parallel through the gated
 * actions, then hands everything to the kit-driven client.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 * The Rust engine may be down at dev time — that normalises into an
 * inline error state instead of crashing the route.
 */

import * as React from 'react';

import {
  getSabcrmInvoiceKpis,
  listSabcrmInvoicesPage,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invoices — SabCRM Finance',
};

export default async function SabcrmFinanceInvoicesPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmInvoicesPage({ page: 1 }),
    getSabcrmInvoiceKpis(),
  ]);

  return (
    <InvoicesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
