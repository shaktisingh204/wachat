import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { SalaryStructureForm } from '../_components/salary-structure-form';
import { BulkUploadAction } from '../_components/bulk-upload-action';
import { LoaderCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewSalaryStructurePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New salary structure"
            subtitle="Capture an employee's basic / HRA / DA, plus PF, ESI, professional tax."
            primaryAction={<BulkUploadAction />}
        >
            <Suspense fallback={<div className="p-8 flex justify-center"><LoaderCircle className="animate-spin text-zoru-ink-muted" /></div>}>
                <SalaryStructureForm />
            </Suspense>
        </EntityListShell>
    );
}
