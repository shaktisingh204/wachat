import { Suspense } from 'react';
import { getShiftRotations } from '@/app/actions/worksuite/shifts.actions';
import { ShiftRotationClient } from './_components/shift-rotation-client';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';


// Next.js server actions can be passed to client components if they are imported from a server action file.
// We pass it down if needed, but the client component imports it directly.

export const metadata = {
  title: 'Shift Rotations | SabNode',
};

async function ShiftRotationsDataLoader() {
  const initialData = await getShiftRotations();
  return <ShiftRotationClient initialData={initialData} getShiftRotationsAction={getShiftRotations} />;
}

export default function ShiftRotationsPage() {
  return (
    <Suspense fallback={
      <EntityListShell
        title="Shift Rotations"
        subtitle="Define cyclical shift sequences to automate assignment."
      >
        <div className="flex items-center justify-center h-64 text-[var(--st-text-secondary)] text-[13px]">
          Loading shift rotations...
        </div>
      </EntityListShell>
    }>
      <ShiftRotationsDataLoader />
    </Suspense>
  );
}
