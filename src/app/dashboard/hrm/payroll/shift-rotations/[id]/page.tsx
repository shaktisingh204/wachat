import { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import ShiftRotationClient from './client-page';
import {
  getShiftRotation,
  getRotationSequences,
  getEmployeeShifts,
} from '@/app/actions/worksuite/shifts.actions';

export default async function ShiftRotationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const rotationId = params.id;

  // We await these in the Server Component. Suspense at the layout level (or our custom loading boundary if we had one wrapping this page) will show a loading state.
  // The error.tsx boundary will catch any failures here.
  const [rotation, sequences, shifts] = await Promise.all([
    getShiftRotation(rotationId),
    getRotationSequences(rotationId),
    getEmployeeShifts(),
  ]);

  if (!rotation) {
    return (
      <EntityListShell title="Rotation Not Found" subtitle="The requested shift rotation does not exist.">
        <div className="p-8 text-center text-[13px] text-zoru-ink-muted">
          Rotation not found.
        </div>
      </EntityListShell>
    );
  }

  return (
    <EntityListShell
      title={rotation.name ?? 'Rotation Details'}
      subtitle={rotation.description || 'Build the repeating sequence of shifts.'}
    >
      <Suspense fallback={<div className="p-8 text-center text-zoru-ink-muted text-[13px]">Loading workspace data...</div>}>
        <ShiftRotationClient 
          id={rotationId}
          initialRotation={rotation}
          initialSequences={sequences}
          shifts={shifts}
        />
      </Suspense>
    </EntityListShell>
  );
}
