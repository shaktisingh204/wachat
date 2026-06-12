/**
 * SabCRM Finance — Sales orders (`/sabcrm/finance/sales-orders`).
 *
 * Server entry for the doc-surface sales-order vertical (finance-rollout
 * spec §3.2). Fetches page 1 of display-ready rows (party labels
 * resolved server-side — no ObjectIds reach the client) plus the KPI
 * strip in parallel through the gated actions, then hands everything to
 * the kit-driven client.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmSalesOrderKpis,
  listSabcrmSalesOrdersPage,
} from '@/app/actions/sabcrm-finance-sales-orders.actions';
import { SalesOrdersClient } from './sales-orders-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sales orders — SabCRM Finance',
};

export default async function SabcrmFinanceSalesOrdersPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmSalesOrdersPage({ page: 1 }),
    getSabcrmSalesOrderKpis(),
  ]);

  return (
    <SalesOrdersClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
