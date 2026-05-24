import { Suspense } from 'react';
import { getShiftRotations } from '@/app/actions/worksuite/shifts.actions';
import { ShiftRotationClient } from './_components/shift-rotation-client';
import { EntityListShell } from '@/components/crm/entity-list-shell';

// Next.js server actions can be passed to client components if they are imported from a server action file.
// We pass it down if needed, but the client component imports it directly.

export const metadata = {
  title: 'Shift Rotations | SabNode',
};

export default async function ShiftRotationsPage() {
  const initialData = await getShiftRotations();

  return (
    <Suspense fallback={
      <EntityListShell
        title="Shift Rotations"
        subtitle="Define cyclical shift sequences to automate assignment."
      >
        <div className="flex items-center justify-center h-64 text-zoru-ink-muted text-[13px]">
          Loading shift rotations...
        </div>
      </EntityListShell>
    }>
      <ShiftRotationClient initialData={initialData} getShiftRotationsAction={getShiftRotations} />
    </Suspense>
  );
}
