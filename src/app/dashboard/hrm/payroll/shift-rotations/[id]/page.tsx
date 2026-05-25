import { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import ShiftRotationClient from './client-page';
import {
  getShiftRotation,
  getRotationSequences,
  getEmployeeShifts,
} from '@/app/actions/worksuite/shifts.actions';
import { notFound } from 'next/navigation';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';


async function ShiftRotationDataFetcher({ id }: { id: string }) {
  try {
    const [rotation, sequences, shifts] = await Promise.all([
      getShiftRotation(id),
      getRotationSequences(id),
      getEmployeeShifts(),
    ]);

    if (!rotation) {
      notFound();
    }

    return (
      <EntityListShell
        title={rotation.name ?? 'Rotation Details'}
        subtitle={rotation.description || 'Build the repeating sequence of shifts.'}
      >
        <ShiftRotationClient 
          id={id}
          initialRotation={rotation}
          initialSequences={sequences}
          shifts={shifts}
        />
      </EntityListShell>
    );
  } catch (error) {
    // Re-throw so the error.tsx boundary handles it (explicit error boundary)
    throw error;
  }
}

export default function ShiftRotationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense 
      fallback={
        <EntityListShell title="Loading Rotation..." subtitle="Fetching details...">
          <div className="space-y-4 p-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </EntityListShell>
      }
    >
      <ShiftRotationDataFetcher id={params.id} />
    </Suspense>
  );
}
