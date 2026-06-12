/**
 * SabCRM People — Shifts (`/sabcrm/people/shifts`, spec WI-28).
 *
 * Server entry for the shift-catalog doc surface. Fetches page 1 of
 * display-ready rows (department labels resolved server-side) plus the
 * KPI strip in parallel through the gated actions, then hands
 * everything to the kit-driven client. `?open=<id>` deep-links the
 * full-field edit drawer.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmShiftKpis,
  listSabcrmShiftsPage,
} from '@/app/actions/sabcrm-people-shifts.actions';
import { ShiftsClient } from './shifts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shifts — SabCRM People',
};

export default async function SabcrmPeopleShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [pageRes, kpiRes, sp] = await Promise.all([
    listSabcrmShiftsPage({ page: 1 }),
    getSabcrmShiftKpis(),
    searchParams,
  ]);
  const openId = typeof sp.open === 'string' ? sp.open : null;

  return (
    <ShiftsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialOpenId={openId}
    />
  );
}
