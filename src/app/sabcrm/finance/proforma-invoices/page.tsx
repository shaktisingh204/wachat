/**
 * SabCRM Finance — Proforma invoices
 * (`/sabcrm/finance/proforma-invoices`).
 *
 * Server entry for the doc-surface proforma vertical (finance-rollout
 * spec §3.3 — legacy mounted shape, TitleCase statuses, 0-indexed
 * pagination handled inside the actions). Fetches page 1 of
 * display-ready rows plus the KPI strip in parallel through the gated
 * actions, then hands everything to the kit-driven client.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmProformaKpis,
  listSabcrmProformaPage,
} from '@/app/actions/sabcrm-finance-proforma.actions';
import { ProformaInvoicesClient } from './proforma-invoices-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Proforma invoices — SabCRM Finance',
};

export default async function SabcrmFinanceProformaInvoicesPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmProformaPage({ page: 1 }),
    getSabcrmProformaKpis(),
  ]);

  return (
    <ProformaInvoicesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
