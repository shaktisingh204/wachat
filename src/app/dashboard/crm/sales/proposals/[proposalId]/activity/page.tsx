import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getProposalById } from '@/app/actions/worksuite/proposals.actions';

interface PageProps {
    params: Promise<{ proposalId: string }>;
}

export default async function ProposalActivityPage({ params }: PageProps) {
    const { proposalId } = await params;
    const res = await getProposalById(proposalId);
    if (!res || ('error' in res && !('proposal' in res))) notFound();
    const proposal = (res as { proposal?: Record<string, unknown> }).proposal;
    if (!proposal) notFound();
    const title = String(
        (proposal as Record<string, unknown>).proposal_number ??
            (proposal as Record<string, unknown>).title ??
            'Proposal',
    );

    return (
        <EntityDetailShell
            title={title}
            eyebrow="PROPOSAL ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/proposals/${proposalId}`,
                label: 'Back to proposal',
            }}
        >
            <EntityAuditTimeline entityKind="proposal" entityId={proposalId} />
        </EntityDetailShell>
    );
}
