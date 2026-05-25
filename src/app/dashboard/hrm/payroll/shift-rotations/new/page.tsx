import { redirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * New shift-rotation page — server wrapper around `<RotationForm />`.
 *
 * Loads the list of shifts up-front so the pattern repeater can render
 * its select options without an extra client-side round-trip.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getShifts } from '@/app/actions/crm-shifts.actions';
import { Skeleton } from '@/components/ui/skeleton';

import { RotationForm } from '../_components/rotation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/shift-rotations';

import { AlertCircle } from 'lucide-react';

async function RotationFormWrapper() {
    try {
        const shiftsRes = await getShifts({ limit: 200, status: 'active' });
        return <RotationForm shifts={shiftsRes.items ?? []} />;
    } catch (error: any) {
        return (
            <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <p className="text-sm font-medium">
                    Failed to load shifts. {error?.message}
                </p>
            </div>
        );
    }
}

export default async function NewShiftRotationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Shift Rotation"
            subtitle="Build a repeating shift pattern for an employee, department or team."
        >
            <Suspense fallback={
                <div className="space-y-4 rounded-[var(--zoru-radius)] border bg-card p-6">
                    <Skeleton className="h-10 w-full max-w-sm" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            }>
                <RotationFormWrapper />
            </Suspense>
        </EntityListShell>
    );
}
