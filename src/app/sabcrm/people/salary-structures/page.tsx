/**
 * SabCRM People — Salary structures
 * (`/sabcrm/people/salary-structures`, WI-31).
 *
 * Server entry for the rich-shape structure catalog (WI-8 — the
 * canonical `hrm_payroll_types::SalaryStructure` with components[] and
 * applicableTo[], NOT the legacy flat per-employee rows). Fetches page
 * 1 of display-ready rows (applicability labels resolved server-side)
 * through the gated actions; `?open=<id>` deep-links the full-field
 * edit drawer.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import { listSabcrmSalaryStructuresPage } from '@/app/actions/sabcrm-people-salary-structures.actions';
import { SalaryStructuresClient } from './salary-structures-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Salary structures — SabCRM People',
};

export default async function SabcrmPeopleSalaryStructuresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [pageRes, sp] = await Promise.all([
    listSabcrmSalaryStructuresPage({ page: 1, status: '' }),
    searchParams,
  ]);
  const openId = typeof sp.open === 'string' ? sp.open : null;

  return (
    <SalaryStructuresClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      initialOpenId={openId}
    />
  );
}
