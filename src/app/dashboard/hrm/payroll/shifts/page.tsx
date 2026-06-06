import * as React from 'react';
import { Suspense } from 'react';
import { getShifts } from '@/app/actions/crm-shifts.actions';
import ShiftsClient from './_components/shifts-client';
import { LoaderCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';


export const metadata = {
    title: 'Shifts | Payroll | HR',
};

export default async function ShiftsPage() {
    return (
        <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
            </div>
        }>
            <ShiftsDataLoader />
        </Suspense>
    );
}

async function ShiftsDataLoader() {
    const res = await getShifts({ limit: 500 });
    const shifts = res?.items ?? [];
    return <ShiftsClient initialShifts={shifts} />;
}
