/**
 * SabCRM Finance — Reconciliation (`/sabcrm/finance/reconciliation`).
 *
 * Server entry for the doc-surface-kit adopter (spec §3.17). Fetches
 * page 1 of display-ready rows (payment-account labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client (full dialog form with a REAL account picker,
 * "Complete run" workflow, bulk completion, CSV).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmReconciliationKpis,
  listSabcrmReconciliationsPage,
} from '@/app/actions/sabcrm-finance-reconciliation.actions';
import { ReconciliationClient } from './reconciliation-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reconciliation — SabCRM Finance',
};

export default async function SabcrmFinanceReconciliationPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmReconciliationsPage({ page: 1 }),
    getSabcrmReconciliationKpis(),
  ]);

  return (
    <ReconciliationClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
