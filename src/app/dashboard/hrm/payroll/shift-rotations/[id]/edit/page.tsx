import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit shift-rotation page — server wrapper that loads the rotation by id
 * and passes it as `initialData` to `<RotationForm />`. Shifts are loaded
 * up-front so the pattern repeater can render its select options.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getShiftRotationById } from '@/app/actions/crm-shift-rotations.actions';
import { getShifts } from '@/app/actions/crm-shifts.actions';

import { RotationForm } from '../../_components/rotation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/shift-rotations';

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
            <RotationForm
                initialData={rotation}
                shifts={shiftsRes.items ?? []}
            />
        </EntityListShell>
    );
}
