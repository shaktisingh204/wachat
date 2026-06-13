/**
 * SabCRM People — Time logs (`/sabcrm/people/time-logs`, WI-34).
 *
 * Server entry for the timesheet doc surface. Fetches page 1 of
 * display-ready rows (employee + work-item labels resolved server-side
 * — raw ObjectIds never reach the client) plus the timesheet KPI strip
 * in parallel through the gated actions.
 *
 * Deep links: `?q= / ?status= / ?partyId=<employeeId> / ?from= / ?to=`
 * seed the toolbar; `?open=<id>` opens the full-field edit drawer.
 */

import * as React from 'react';

import {
  getSabcrmTimeLogKpis,
  listSabcrmTimeLogsPage,
} from '@/app/actions/sabcrm-people-time-logs.actions';
import type { CrmTimeLogStatus } from '@/lib/rust-client/crm-time-logs';
import { TimeLogsClient } from './time-logs-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Time logs — SabCRM People',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmPeopleTimeLogsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmTimeLogStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);
  const openId = first(params.open) ?? null;

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmTimeLogsPage({
      page: 1,
      q: q || undefined,
      status,
      employeeId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmTimeLogKpis(),
  ]);

  return (
    <TimeLogsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialOpenId={openId}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
    />
  );
}
