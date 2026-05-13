import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../../crm/_components/crm-page-header';
import { getCrmExitById } from '@/app/actions/crm-exits.actions';
import { ExitForm } from '../../new/exit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ExitEditPage({ params }: PageProps) {
    const { id } = await params;
    const exit = await getCrmExitById(id);
    if (!exit) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader title={`Edit exit`} />
            <ExitForm exit={{ ...(exit as any), _id: String((exit as any)._id ?? id) }} />
        </div>
    );
}
