import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getServiceContractById } from '@/app/actions/crm-service-contracts.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ServiceContractActivityPage({ params }: PageProps) {
    const { id } = await params;
    const c = await getServiceContractById(id);
    if (!c) notFound();

    return (
        <EntityDetailShell
            title={c.contractNo || 'Service Contract'}
            eyebrow="CONTRACT ACTIVITY"
            back={{ href: `/dashboard/crm/service-contracts/${id}`, label: 'Back to contract' }}
        >
            <EntityAuditTimeline entityKind="service_contract" entityId={id} />
        </EntityDetailShell>
    );
}
