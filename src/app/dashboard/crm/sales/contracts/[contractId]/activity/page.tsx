import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getContractById } from '@/app/actions/crm-contracts.actions';

interface PageProps {
    params: Promise<{ contractId: string }>;
}

export default async function ContractActivityPage({ params }: PageProps) {
    const { contractId } = await params;
    const contract = await getContractById(contractId);
    if (!contract) notFound();
    const title = String((contract as any).title ?? 'Contract');

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${title} — Activity`}
                subtitle="Audit trail of changes made to this contract."
            />
            <EntityDetailShell
                title={title}
                eyebrow="CONTRACT ACTIVITY"
                back={{
                    href: `/dashboard/crm/sales/contracts/${contractId}`,
                    label: 'Back to contract',
                }}
            >
                <EntityAuditTimeline entityKind="contract" entityId={contractId} />
            </EntityDetailShell>
        </div>
    );
}
