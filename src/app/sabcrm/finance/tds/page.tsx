/**
 * SabCRM Finance — TDS records (`/sabcrm/finance/tds`).
 *
 * Server entry for the doc-surface-kit adopter (spec §3.19). Fetches
 * page 1 of display-ready rows plus the FY-scoped KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client (full dialog form with the people picker, FY +
 * quarter filters, deposit → file workflow, bulk transitions, CSV).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmTdsKpis,
  listSabcrmTdsRecordsPage,
} from '@/app/actions/sabcrm-finance-tds.actions';
import { TdsClient } from './tds-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'TDS — SabCRM Finance',
};

export default async function SabcrmFinanceTdsPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmTdsRecordsPage({ page: 1 }),
    getSabcrmTdsKpis(),
  ]);

  return (
    <TdsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
