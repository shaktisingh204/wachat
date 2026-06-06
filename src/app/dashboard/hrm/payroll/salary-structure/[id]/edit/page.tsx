import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';
import { SalaryStructureForm } from '../../_components/salary-structure-form';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EditHeaderActions } from './edit-actions';

export const dynamic = 'force-dynamic';



async function EditShell({ id }: { id: string }) {
    let doc;
    try {
        doc = await getSalaryStructureDoc(id);
    } catch (err) {
        return (
            <EntityListShell
                title="Error"
                subtitle="Failed to load structure"
            >
                <div className="flex flex-col items-center justify-center p-8 space-y-4 rounded-xl border border-zoru-line bg-zoru-surface-2 text-zoru-ink">
                    <p className="font-medium text-lg">Data fetching failed.</p>
                    <p className="text-sm">We could not retrieve the requested salary structure. It might not exist or there is a network issue.</p>
                </div>
            </EntityListShell>
        );
    }
    
    if (!doc) notFound();
    
    const label = doc.employeeName ?? doc.employeeId ?? id;
    
    return (
        <EntityListShell
            title={`Edit · ${label}`}
            subtitle="Update earnings, deductions, or archive this structure."
            headerActions={<EditHeaderActions id={id} data={doc} />}
        >
            <Suspense fallback={<FormSkeleton />}>
                <SalaryStructureForm initialData={doc} />
            </Suspense>
        </EntityListShell>
    );
}

function FormSkeleton() {
    return (
        <div className="space-y-4 rounded-xl border border-zoru-line bg-zoru-surface p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="mt-6 h-[200px] w-full" />
        </div>
    );
}

export default async function EditSalaryStructurePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <Suspense fallback={
            <EntityListShell
                title="Edit Salary Structure"
                subtitle="Loading..."
            >
                <FormSkeleton />
            </EntityListShell>
        }>
            <EditShell id={id} />
        </Suspense>
    );
}
