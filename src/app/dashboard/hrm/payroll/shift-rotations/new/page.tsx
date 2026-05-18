import { redirect } from 'next/navigation';

/**
 * New shift-rotation page — server wrapper around `<RotationForm />`.
 *
 * Loads the list of shifts up-front so the pattern repeater can render
 * its select options without an extra client-side round-trip.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getShifts } from '@/app/actions/crm-shifts.actions';

import { RotationForm } from '../_components/rotation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/shift-rotations';

export default async function NewShiftRotationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const shiftsRes = await getShifts({ limit: 200, status: 'active' });

    return (
        <EntityListShell
            title="New Shift Rotation"
            subtitle="Build a repeating shift pattern for an employee, department or team."
        >
            <RotationForm shifts={shiftsRes.items ?? []} />
        </EntityListShell>
    );
}
