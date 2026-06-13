/**
 * SabCRM People — Shift change requests
 * (`/sabcrm/people/shift-changes`, spec WI-30).
 *
 * Server entry for the shift-change-request doc surface. Fetches
 * page 1 of display-ready rows (employee / shift names are cached at
 * write time; missing ones resolve server-side) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client. `?open=<id>` deep-links the request drawer
 * (detail + approve / reject decision).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmShiftChangeKpis,
  listSabcrmShiftChangesPage,
} from '@/app/actions/sabcrm-people-shift-changes.actions';
import { ShiftChangesClient } from './shift-changes-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shift changes — SabCRM People',
};

export default async function SabcrmPeopleShiftChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [pageRes, kpiRes, sp] = await Promise.all([
    listSabcrmShiftChangesPage({ page: 1 }),
    getSabcrmShiftChangeKpis(),
    searchParams,
  ]);
  const openId = typeof sp.open === 'string' ? sp.open : null;

  return (
    <ShiftChangesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialOpenId={openId}
    />
  );
}
