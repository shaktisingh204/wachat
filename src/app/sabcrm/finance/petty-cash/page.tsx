/**
 * SabCRM Finance — Petty cash (`/sabcrm/finance/petty-cash`).
 *
 * Server entry for the doc-surface petty-cash vertical (spec §3.15).
 * Fetches page 1 of display-ready rows (custodian labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions.
 *
 * NB: crate `crm-petty-cash` pages are 0-indexed and its entity wire
 * carries extended JSON — both traps are owned by the actions file.
 */

import * as React from 'react';

import {
  getSabcrmPettyCashKpis,
  listSabcrmPettyCashPage,
} from '@/app/actions/sabcrm-finance-petty-cash.actions';
import { PettyCashClient } from './petty-cash-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Petty cash — SabCRM Finance',
};

export default async function SabcrmFinancePettyCashPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPettyCashPage({ page: 1 }),
    getSabcrmPettyCashKpis(),
  ]);

  return (
    <PettyCashClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
