import { Suspense } from 'react';
import { getSalaryStructures } from '@/app/actions/crm-payroll.actions';
import { SalaryStructureClient } from './_components/salary-structure-client';
import { LoaderCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';


export default async function SalaryStructurePage() {
    return (
        <Suspense fallback={<SalaryStructureLoading />}>
            <SalaryStructureDataLoader />
        </Suspense>
    );
}

async function SalaryStructureDataLoader() {
    const structures = await getSalaryStructures();
    return <SalaryStructureClient initialStructures={structures} />;
}

function SalaryStructureLoading() {
    return (
        <div className="flex h-[400px] items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
        </div>
    );
}
