import * as React from 'react';
import { Suspense } from 'react';
import PermissionGroupsClient from './_components/permission-groups-client';
import Loading from './loading';
import { LocalErrorBoundary } from './_components/local-error-boundary';
export const dynamic = 'force-dynamic';

import {
  getPermissionGroups,
  getPermissionGroupKpis,
  getHrmEmployeeList,
  getEmployeesInGroup,
} from '@/app/actions/hrm-permission-groups.actions';

export const metadata = {
  title: 'Permission Groups | HRM',
};

export default function PermissionGroupsPage() {
  return (
    <LocalErrorBoundary>
      <Suspense fallback={<Loading />}>
        <DataLoader />
      </Suspense>
    </LocalErrorBoundary>
  );
}

async function DataLoader() {
  const [groups, kpis, employees] = await Promise.all([
    getPermissionGroups(),
    getPermissionGroupKpis(),
    getHrmEmployeeList(),
  ]);

  const allAssignments: { employeeId: string; groupId: string }[] = [];
  await Promise.all(
    groups.map(async (g) => {
      const emps = await getEmployeesInGroup(g._id);
      for (const e of emps) {
        allAssignments.push({ employeeId: e.employeeId, groupId: g._id });
      }
    }),
  );

  return (
    <PermissionGroupsClient
      initialGroups={groups}
      initialKpis={kpis}
      initialEmployees={employees}
      initialAssignments={allAssignments}
    />
  );
}
