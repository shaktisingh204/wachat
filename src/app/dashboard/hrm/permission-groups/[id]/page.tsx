import * as React from 'react';
import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { ClientPage } from './_components/client-page';
export const dynamic = 'force-dynamic';

import {
  getPermissionGroupById,
  getEmployeesInGroup,
  getHrmEmployeeList,
} from '@/app/actions/hrm-permission-groups.actions';

export default async function PermissionGroupEditPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Support Next.js 15+ promise-based params as well as older versions
  const id = typeof (params as any).then === 'function' 
    ? (await params).id 
    : (params as { id: string }).id;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <DataLoader id={id} />
    </Suspense>
  );
}

async function DataLoader({ id }: { id: string }) {
  try {
    const [group, empAssignments, allEmployees] = await Promise.all([
      getPermissionGroupById(id),
      getEmployeesInGroup(id),
      getHrmEmployeeList(),
    ]);

    return (
      <ClientPage
        id={id}
        initialGroup={group}
        initialEmpAssignments={empAssignments}
        allEmployees={allEmployees}
      />
    );
  } catch (error) {
    console.error('Error fetching data for Permission Group:', error);
    throw new Error('Failed to load permission group details. Please try again.');
  }
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-[var(--zoru-radius)]" />
        ))}
      </div>
    </div>
  );
}
