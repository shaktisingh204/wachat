/**
 * SabCRM People — Holidays (`/sabcrm/people/holidays`, spec WI-27).
 *
 * Server entry for the holiday calendar. Fetches page 1 of
 * display-ready rows through the gated actions, then hands everything
 * to the kit-driven client. `?open=<id>` deep-links the full-field
 * edit drawer (rows navigate there — no detail route, per spec).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import { listSabcrmHolidaysPage } from '@/app/actions/sabcrm-people-holidays.actions';
import { HolidaysClient } from './holidays-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Holidays — SabCRM People',
};

export default async function SabcrmPeopleHolidaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [pageRes, sp] = await Promise.all([
    listSabcrmHolidaysPage({ page: 1, holidayType: '' }),
    searchParams,
  ]);
  const openId = typeof sp.open === 'string' ? sp.open : null;

  return (
    <HolidaysClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      initialOpenId={openId}
    />
  );
}
