import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
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
        <div className="space-y-6">
            <CrmPageHeader title={`Edit ${c.contractNo || c.title || 'service contract'}`} />
            <ServiceContractEditForm contract={{ ...c, _id: String(c._id ?? id) }} />
        </div>
    );
}
