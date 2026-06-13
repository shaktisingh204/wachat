/**
 * SabCRM People — Shift rotations (`/sabcrm/people/shift-rotations`,
 * spec WI-29).
 *
 * Server entry for the rotation-schedule doc surface. Fetches page 1
 * of display-ready rows (target + pattern-shift labels resolved
 * server-side) plus the KPI strip in parallel through the gated
 * actions, then hands everything to the kit-driven client.
 * `?open=<id>` deep-links the full-field edit drawer.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmShiftRotationKpis,
  listSabcrmShiftRotationsPage,
} from '@/app/actions/sabcrm-people-shift-rotations.actions';
import { ShiftRotationsClient } from './shift-rotations-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shift rotations — SabCRM People',
};

export default async function SabcrmPeopleShiftRotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [pageRes, kpiRes, sp] = await Promise.all([
    listSabcrmShiftRotationsPage({ page: 1 }),
    getSabcrmShiftRotationKpis(),
    searchParams,
  ]);
  const openId = typeof sp.open === 'string' ? sp.open : null;

  return (
    <ShiftRotationsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialOpenId={openId}
    />
  );
}
