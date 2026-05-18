import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getServiceContractById } from '@/app/actions/crm-service-contracts.actions';
import { ServiceContractEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ServiceContractEditPage({ params }: PageProps) {
    const { id } = await params;
    const c = await getServiceContractById(id);
    if (!c) notFound();

    return (
        <EntityDetailShell
            eyebrow="SERVICE CONTRACT"
            title={`Edit · ${c.contractNo || c.title || 'service contract'}`}
            back={{ href: `/dashboard/crm/service-contracts/${id}`, label: 'Back to contract' }}
        >
            <ServiceContractEditForm contract={{ ...c, _id: String(c._id ?? id) }} />
        </EntityDetailShell>
    );
}
