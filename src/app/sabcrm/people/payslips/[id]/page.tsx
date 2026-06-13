/**
 * SabCRM People — Payslip detail (`/sabcrm/people/payslips/[id]`,
 * WI-33).
 *
 * Server entry for the payslip paper page. One gated action returns the
 * unified document (rich run-generated OR legacy flat — WI-9/R7) plus a
 * resolved employee label for flat rows; the client branches shapes.
 */

import * as React from 'react';

import { getSabcrmPayslip } from '@/app/actions/sabcrm-people-payslips.actions';
import { PayslipDetailClient } from './payslip-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payslip — SabCRM People',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmPeoplePayslipDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const res = await getSabcrmPayslip(id);

  return (
    <PayslipDetailClient
      detail={res.ok ? res.data : null}
      error={res.ok ? null : res.error}
    />
  );
}
