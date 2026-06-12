/**
 * SabCRM People — Employees (`/sabcrm/people/employees`).
 *
 * Server entry for the People-suite flagship directory. Fetches page 1
 * of display-ready rows (department labels resolved server-side — no
 * ObjectIds reach the client) plus the KPI strip in parallel through
 * the gated actions, then hands everything to the kit-driven client.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 * The Rust engine may be down at dev time — that normalises into an
 * inline error state instead of crashing the route.
 */

import * as React from 'react';

import {
  getSabcrmEmployeeKpis,
  listSabcrmEmployeesPage,
} from '@/app/actions/sabcrm-people-employees.actions';
import { EmployeesClient } from './employees-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Employees — SabCRM People',
};

export default async function SabcrmPeopleEmployeesPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmEmployeesPage({ page: 1, status: '' }),
    getSabcrmEmployeeKpis(),
  ]);

  return (
    <EmployeesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
