import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../../crm/_components/crm-page-header';
import { getCrmSuccessionPlanById } from '@/app/actions/crm-succession.actions';
import { SuccessionForm } from '../../new/succession-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function SuccessionEditPage({ params }: PageProps) {
    const { id } = await params;
    const plan = await getCrmSuccessionPlanById(id);
    if (!plan) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader title={`Edit succession plan`} />
            <SuccessionForm plan={{ ...(plan as any), _id: String((plan as any)._id ?? id) }} />
        </div>
    );
}
