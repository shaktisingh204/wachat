/**
 * SabCRM Finance — Invoices (`/sabcrm/finance/invoices`).
 *
 * Server entry for the flagship doc-surface vertical. Fetches page 1 of
 * display-ready rows (party labels resolved server-side — no ObjectIds
 * reach the client) plus the KPI strip in parallel through the gated
 * actions, then hands everything to the kit-driven client.
 *
 * Deep links: `?q= / ?status= / ?partyId= / ?from= / ?to=` seed the
 * toolbar filters AND the initial fetch (statements drill-down, §1.4) —
 * P&L revenue cells, GST GSTR-1 rows and balance-sheet AR land here.
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
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invoices — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceInvoicesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmInvoiceStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmInvoicesPage({
      page: 1,
      q: q || undefined,
      status,
      clientId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmInvoiceKpis(),
  ]);

  return (
    <InvoicesClient
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
