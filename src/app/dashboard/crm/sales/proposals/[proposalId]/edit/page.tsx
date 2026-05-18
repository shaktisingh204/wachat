import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileText } from 'lucide-react';

/**
 * Edit proposal page — server wrapper that loads the proposal by id and
 * passes it to `<ProposalForm initialData={...} />`.
 *
 * Section repeater + SabFile attachments are handled inside the form.
 * Async `params` per Next.js 15+ conventions.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${title}`}
                subtitle="Update sections, attachments and lifecycle status."
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${proposalId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <ProposalForm
                initialData={proposal as Record<string, unknown>}
            />
        </div>
    );
}
