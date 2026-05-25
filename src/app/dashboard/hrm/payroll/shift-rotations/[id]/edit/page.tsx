import { notFound, redirect } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getShiftRotationById } from '@/app/actions/crm-shift-rotations.actions';
import { getShifts } from '@/app/actions/crm-shifts.actions';
import { RotationForm } from '../../_components/rotation-form';
import { ExportRotationButton } from './export-button';

import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EditShiftRotationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: rotationId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title={`Edit Rotation`}
            subtitle="Update rotation scope, pattern and cycle."
        >
            <Suspense fallback={
                <div className="flex h-64 items-center justify-center rounded-lg border border-zoru-line bg-zoru-surface">
                    <div className="flex flex-col items-center gap-2 text-zoru-ink-muted">
                        <LoaderCircle className="h-8 w-8 animate-spin text-zoru-primary" />
                        <span className="text-sm font-medium">Loading rotation...</span>
                    </div>
                </div>
            }>
                <EditShiftRotationContent rotationId={rotationId} />
            </Suspense>
        </EntityListShell>
    );
}

async function EditShiftRotationContent({ rotationId }: { rotationId: string }) {
    const [rotation, shiftsRes] = await Promise.all([
        getShiftRotationById(rotationId),
        getShifts({ limit: 200, status: 'active' }),
    ]);
    
    if (!rotation) notFound();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zoru-ink">{rotation.name}</h3>
                <ExportRotationButton rotation={rotation} shifts={shiftsRes.items ?? []} />
            </div>
            <RotationForm
                initialData={rotation}
                shifts={shiftsRes.items ?? []}
            />
        </div>
    );
}
