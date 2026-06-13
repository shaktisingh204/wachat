/**
 * SabCRM People — Payroll runs (`/sabcrm/people/payroll-runs`, WI-32).
 *
 * Server entry for the payroll flagship doc surface. Fetches page 1 of
 * display-ready rows (period labels + engine-computed totals — money is
 * NEVER re-derived client-side, risk R8) plus the KPI strip in parallel
 * through the gated actions, then hands everything to the kit-driven
 * client. `?q= / ?status= / ?from= / ?to=` deep-link the toolbar.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmPayrollKpis,
  listSabcrmPayrollRunsPage,
} from '@/app/actions/sabcrm-people-payroll-runs.actions';
import type { CrmPayrollRunStatus } from '@/lib/rust-client/crm-payroll-runs';
import { PayrollRunsClient } from './payroll-runs-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payroll runs — SabCRM People',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmPeoplePayrollRunsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmPayrollRunStatus | '';
  const from = first(params.from);
  const to = first(params.to);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmPayrollRunsPage({
      page: 1,
      q: q || undefined,
      status,
      from,
      to,
    }),
    getSabcrmPayrollKpis(),
  ]);

  return (
    <PayrollRunsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || from || to ? { q, status, from, to } : undefined
      }
    />
  );
}
