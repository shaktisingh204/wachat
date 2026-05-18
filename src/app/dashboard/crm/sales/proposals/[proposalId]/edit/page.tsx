import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit proposal page — server wrapper that loads the proposal by id and
 * passes it to `<ProposalForm initialData={...} />`.
 *
 * Section repeater + SabFile attachments are handled inside the form.
 * Async `params` per Next.js 15+ conventions.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getProposalById } from '@/app/actions/crm-proposals.actions';

import { ProposalForm } from '../../_components/proposal-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/proposals';

export default async function EditProposalPage({
    params,
}: {
    params: Promise<{ proposalId: string }>;
}) {
    const { proposalId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const proposal = await getProposalById(proposalId);
    if (!proposal) notFound();

    const title =
        (proposal.title as string | undefined) ||
        (proposal.proposalNumber as string | undefined) ||
        'Proposal';

    return (
        <EntityDetailShell
            eyebrow="PROPOSAL"
            title={`Edit · ${title}`}
            back={{ href: `${BASE}/${proposalId}`, label: 'Proposal' }}
        >
            <ProposalForm
                initialData={proposal as Record<string, unknown>}
            />
        </EntityDetailShell>
    );
}
