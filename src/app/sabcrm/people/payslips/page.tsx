/**
 * SabCRM People — Payslips (`/sabcrm/people/payslips`, WI-33).
 *
 * Server entry for the unified dual-shape payslip surface (rich
 * run-generated payslips + legacy flat CRUD rows — WI-9 / risk R7).
 * Fetches page 1 of display-ready rows (employee labels resolved
 * server-side) through the gated actions, then hands everything to the
 * kit-driven client.
 *
 * Deep links: `?q= / ?status= / ?partyId=<employeeId> / ?from= / ?to=`
 * seed the toolbar; `?runId=` scopes the list to one payroll run (the
 * run detail's lineage rail lands here).
 */

import * as React from 'react';

import { listSabcrmPayslipsPage } from '@/app/actions/sabcrm-people-payslips.actions';
import { PayslipsClient } from './payslips-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payslips — SabCRM People',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmPeoplePayslipsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = first(params.status) ?? '';
  const partyId = first(params.partyId) ?? '';
  const runId = first(params.runId) ?? '';
  const from = first(params.from);
  const to = first(params.to);

  const pageRes = await listSabcrmPayslipsPage({
    page: 1,
    q: q || undefined,
    status,
    employeeId: partyId || undefined,
    runId: runId || undefined,
    from,
    to,
  });

  return (
    <PayslipsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      runId={runId || null}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
    />
  );
}
