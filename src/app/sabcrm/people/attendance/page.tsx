/**
 * SabCRM People — Attendance (`/sabcrm/people/attendance`, spec WI-25).
 *
 * Server entry for the attendance register. Fetches page 1 of
 * display-ready rows (employee + shift labels resolved server-side —
 * no ObjectIds reach the client) plus the present/absent/late-today
 * KPI strip in parallel through the gated actions, then hands
 * everything to the kit-driven client. `?open=<id>` deep-links the
 * full-field detail drawer (rows navigate there, so records are
 * shareable/bookmarkable).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmAttendanceKpis,
  listSabcrmAttendancePage,
} from '@/app/actions/sabcrm-people-attendance.actions';
import { AttendanceClient } from './attendance-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Attendance — SabCRM People',
};

export default async function SabcrmPeopleAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [pageRes, kpiRes, sp] = await Promise.all([
    listSabcrmAttendancePage({ page: 1, status: '' }),
    getSabcrmAttendanceKpis(),
    searchParams,
  ]);
  const openId = typeof sp.open === 'string' ? sp.open : null;

  return (
    <AttendanceClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialOpenId={openId}
    />
  );
}
