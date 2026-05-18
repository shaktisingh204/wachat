import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  RotateCw } from 'lucide-react';

/**
 * Edit shift-rotation page — server wrapper that loads the rotation by id
 * and passes it as `initialData` to `<RotationForm />`. Shifts are loaded
 * up-front so the pattern repeater can render its select options.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Shift Rotations', href: BASE },
                    { label: rotation.name, href: `${BASE}/${rotationId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${rotation.name}`}
                subtitle="Update rotation scope, pattern and cycle."
                icon={RotateCw}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${rotationId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <RotationForm
                initialData={rotation}
                shifts={shiftsRes.items ?? []}
            />
        </div>
    );
}
