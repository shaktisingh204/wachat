import { Suspense } from 'react';
import LeaveDetailClient from './client';
import {
  getLeave,
  getLeaveTypes,
  getLeaveFiles,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui/compat';
import type { WsLeave, WsLeaveFile, WsLeaveType } from '@/lib/worksuite/leave-types';

export const dynamic = 'force-dynamic';

async function LeaveDetailLoader({ id }: { id: string }) {
  const [l, types, emps, fs] = await Promise.all([
    getLeave(id),
    getLeaveTypes(),
    getCrmEmployees(),
    getLeaveFiles(id),
  ]);

  return <LeaveDetailClient initialLeave={l as WsLeave} initialTypes={types as WsLeaveType[]} initialEmployees={emps as any[]} initialFiles={fs as WsLeaveFile[]} id={id} />;
}

export default async function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <EntityListShell title="Leave Application" subtitle="Loading leave details...">
          <Card className="p-6">
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              Loading…
            </div>
          </Card>
        </EntityListShell>
      }
    >
      <LeaveDetailLoader id={id} />
    </Suspense>
  );
}
