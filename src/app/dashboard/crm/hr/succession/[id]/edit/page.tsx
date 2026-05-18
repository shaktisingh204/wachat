import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            title="Edit succession plan"
            eyebrow="SUCCESSION"
            back={{ href: '/dashboard/crm/hr/succession', label: 'Succession' }}
        >
            <SuccessionForm plan={{ ...(plan as any), _id: String((plan as any)._id ?? id) }} />
        </EntityDetailShell>
    );
}
