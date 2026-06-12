/**
 * SabCRM People — Employee detail (`/sabcrm/people/employees/[id]`).
 *
 * Server entry for the People-suite flagship detail surface. Fetches
 * the employee (every FK resolved to a display label — never a raw
 * ObjectId) and the Activity rail (attendance last 30 days / leave
 * applications / payslips) in parallel, then hands everything to the
 * tabbed detail client.
 */

import * as React from 'react';

import {
  getSabcrmEmployee,
  getSabcrmEmployeeActivity,
} from '@/app/actions/sabcrm-people-employees.actions';
import { EmployeeDetailClient } from './employee-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Employee — SabCRM People',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmPeopleEmployeeDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const detailRes = await getSabcrmEmployee(id);
  if (!detailRes.ok) {
    return (
      <EmployeeDetailClient detail={null} activity={null} error={detailRes.error} />
    );
  }

  const activityRes = await getSabcrmEmployeeActivity(id);

  return (
    <EmployeeDetailClient
      detail={detailRes.data}
      activity={activityRes.ok ? activityRes.data : null}
      error={null}
    />
  );
}
