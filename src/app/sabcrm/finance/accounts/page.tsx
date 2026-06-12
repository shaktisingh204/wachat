/**
 * SabCRM Finance — Chart of accounts (`/sabcrm/finance/accounts`).
 *
 * Server entry for the doc-surface-kit adopter (spec §3.18). Fetches
 * page 1 of display-ready rows (account-group + parent labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client (full dialog form with group Select + parent
 * picker, type filter, bulk archive/restore, CSV).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmChartOfAccountKpis,
  listSabcrmChartOfAccountsPage,
} from '@/app/actions/sabcrm-finance-chart-of-accounts.actions';
import { AccountsClient } from './accounts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chart of accounts — SabCRM Finance',
};

export default async function SabcrmFinanceAccountsPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmChartOfAccountsPage({ page: 1 }),
    getSabcrmChartOfAccountKpis(),
  ]);

  return (
    <AccountsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
