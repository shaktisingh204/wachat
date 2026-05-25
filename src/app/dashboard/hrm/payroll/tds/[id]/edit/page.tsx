import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getTdsRecordById } from '@/app/actions/crm-tds.actions';
import { TdsForm } from '../../_components/tds-form';

export const dynamic = 'force-dynamic';

async function EditFormLoader({ id }: { id: string }) {
    const row = await getTdsRecordById(id);
    if (!row) notFound();
    return <TdsForm initialData={row} />;
}

export default async function EditTdsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="Edit TDS Record"
            subtitle="Manage tax deducted at source details"
        >
            <Suspense 
                fallback={
                    <div className="p-6 animate-pulse space-y-6 bg-white rounded-xl shadow-sm border border-slate-200">
                        <div className="h-8 bg-slate-100 rounded w-1/4"></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="h-12 bg-slate-100 rounded w-full"></div>
                            <div className="h-12 bg-slate-100 rounded w-full"></div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="h-12 bg-slate-100 rounded w-full"></div>
                            <div className="h-12 bg-slate-100 rounded w-full"></div>
                            <div className="h-12 bg-slate-100 rounded w-full"></div>
                        </div>
                        <div className="h-24 bg-slate-100 rounded w-full mt-4"></div>
                        <div className="flex justify-between pt-4">
                            <div className="h-10 bg-slate-100 rounded w-24"></div>
                            <div className="h-10 bg-slate-100 rounded w-32"></div>
                        </div>
                    </div>
                }
            >
                <EditFormLoader id={id} />
            </Suspense>
        </EntityListShell>
    );
}
