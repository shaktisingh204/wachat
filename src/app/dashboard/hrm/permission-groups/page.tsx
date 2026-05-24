import * as React from 'react';
import { Suspense } from 'react';
import PermissionGroupsClient from './_components/permission-groups-client';
import Loading from './loading';
import {
  getPermissionGroups,
  getPermissionGroupKpis,
  getHrmEmployeeList,
  getEmployeesInGroup,
} from '@/app/actions/hrm-permission-groups.actions';

export const metadata = {
  title: 'Permission Groups | HRM',
};

export default async function PermissionGroupsPage() {
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
    <Suspense fallback={<Loading />}>
      <PermissionGroupsClient
        initialGroups={groups}
        initialKpis={kpis}
        initialEmployees={employees}
        initialAssignments={allAssignments}
      />
    </Suspense>
  );
}
