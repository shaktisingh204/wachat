import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, RotateCw } from 'lucide-react';

/**
 * New shift-rotation page — server wrapper around `<RotationForm />`.
 *
 * Loads the list of shifts up-front so the pattern repeater can render
 * its select options without an extra client-side round-trip.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Shift Rotations', href: BASE },
                    { label: 'New' },
                ]}
                title="New Shift Rotation"
                subtitle="Build a repeating shift pattern for an employee, department or team."
                icon={RotateCw}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <RotationForm shifts={shiftsRes.items ?? []} />
        </div>
    );
}
