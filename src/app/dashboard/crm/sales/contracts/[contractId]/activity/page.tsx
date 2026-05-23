import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getContractById } from '@/app/actions/crm-contracts.actions';
import { ESignatureDashboard } from './e-signature-dashboard';

interface PageProps {
    params: Promise<{ contractId: string }>;
}

export default async function ContractActivityPage({ params }: PageProps) {
    const { contractId } = await params;
    const contract = await getContractById(contractId);
    if (!contract) notFound();
    const title = String((contract as any).title ?? 'Contract');

    return (
        <EntityDetailShell
            title={title}
            eyebrow="CONTRACT ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/contracts/${contractId}`,
                label: 'Back to contract',
            }}
        >
            <div className="space-y-6">
                <ESignatureDashboard 
                    contractId={contractId} 
                    provider={contract.esignProvider || 'none'}
                    partyName={contract.partyName || ''}
                    partyEmail={contract.partyEmail || ''}
                />
                <EntityAuditTimeline entityKind="contract" entityId={contractId} />
            </div>
        </EntityDetailShell>
    );
}
