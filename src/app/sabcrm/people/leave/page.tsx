/**
 * SabCRM People — Leave (`/sabcrm/people/leave`, spec WI-26).
 *
 * Server entry for the tabbed leave surface (Applications | Types).
 * Fetches page 1 of BOTH tabs plus the KPI strip in parallel through
 * the gated actions, then hands everything to the kit-driven client.
 *
 * Deep links: `?tab=applications|types` selects the tab,
 * `?open=<id>` opens an application's detail drawer (approver-chain
 * timeline + approve), `?type=<id>` opens a leave-type editor.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmLeaveKpis,
  listSabcrmLeaveApplicationsPage,
  listSabcrmLeaveTypesPage,
} from '@/app/actions/sabcrm-people-leave.actions';
import type { LeaveTab } from './leave-config';
import { LeaveClient } from './leave-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Leave — SabCRM People',
};

export default async function SabcrmPeopleLeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [appsRes, typesRes, kpiRes, sp] = await Promise.all([
    listSabcrmLeaveApplicationsPage({ page: 1 }),
    listSabcrmLeaveTypesPage({ page: 1 }),
    getSabcrmLeaveKpis(),
    searchParams,
  ]);

  const tab: LeaveTab = sp.tab === 'types' ? 'types' : 'applications';
  const openApplicationId = typeof sp.open === 'string' ? sp.open : null;
  const openTypeId = typeof sp.type === 'string' ? sp.type : null;

  return (
    <LeaveClient
      initialTab={tab}
      initialApplicationRows={appsRes.ok ? appsRes.data.rows : []}
      initialApplicationsHasMore={appsRes.ok ? appsRes.data.hasMore : false}
      initialApplicationsError={appsRes.ok ? null : appsRes.error}
      initialTypeRows={typesRes.ok ? typesRes.data.rows : []}
      initialTypesHasMore={typesRes.ok ? typesRes.data.hasMore : false}
      initialTypesError={typesRes.ok ? null : typesRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialOpenApplicationId={openApplicationId}
      initialOpenTypeId={openTypeId}
    />
  );
}
