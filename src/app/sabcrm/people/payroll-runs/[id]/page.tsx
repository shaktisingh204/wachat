/**
 * SabCRM People — Payroll run detail
 * (`/sabcrm/people/payroll-runs/[id]`, WI-32).
 *
 * Server entry for the payroll-run paper page. One gated action fetch
 * returns the run plus its display-ready context: employee rows and the
 * approval chain with labels batch-resolved server-side (raw ObjectIds
 * never reach the client) and the generated-payslips lineage.
 */

import * as React from 'react';

import { getSabcrmPayrollRun } from '@/app/actions/sabcrm-people-payroll-runs.actions';
import { PayrollRunDetailClient } from './payroll-run-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payroll run — SabCRM People',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmPeoplePayrollRunDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const res = await getSabcrmPayrollRun(id);

  return (
    <PayrollRunDetailClient
      detail={res.ok ? res.data : null}
      error={res.ok ? null : res.error}
    />
  );
}
