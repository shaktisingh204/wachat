import { notFound, redirect } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getShiftRotationById } from '@/app/actions/crm-shift-rotations.actions';
import { getShifts } from '@/app/actions/crm-shifts.actions';
import { RotationForm } from '../../_components/rotation-form';
import { ExportRotationButton } from './export-button';

export const dynamic = 'force-dynamic';

export default async function EditShiftRotationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: rotationId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const [rotation, shiftsRes] = await Promise.all([
        getShiftRotationById(rotationId),
        getShifts({ limit: 200, status: 'active' }),
    ]);
    
    if (!rotation) notFound();

    return (
        <EntityListShell
            title={`Edit · ${rotation.name}`}
            subtitle="Update rotation scope, pattern and cycle."
        >
            <div className="space-y-4">
                <div className="flex justify-end">
                    <ExportRotationButton rotation={rotation} shifts={shiftsRes.items ?? []} />
                </div>
                <RotationForm
                    initialData={rotation}
                    shifts={shiftsRes.items ?? []}
                />
            </div>
        </EntityListShell>
    );
}
