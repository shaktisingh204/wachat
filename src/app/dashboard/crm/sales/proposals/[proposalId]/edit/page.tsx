import {
  notFound,
  redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';
import { getProposalById, saveProposal } from '@/app/actions/crm-proposals.actions';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';

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

    return (
        <LiveDocumentEditor
            documentType="proposal"
            initialData={proposal as Record<string, unknown>}
            saveAction={saveProposal}
            backHref={BASE}
        />
    );
}
