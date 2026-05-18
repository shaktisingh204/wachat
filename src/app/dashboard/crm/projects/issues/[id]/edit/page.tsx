import {
  notFound } from 'next/navigation';

/**
 * Edit issue — §1B W7. Reuses the shared <IssueForm/>.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';

import { IssueForm } from '../../_components/issue-form';

export const dynamic = 'force-dynamic';

export default async function EditIssuePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const issue = await getIssueById(id);
    if (!issue) notFound();
    const i = issue as Record<string, unknown> & { _id: string };

    return (
        <EntityDetailShell
            eyebrow="ISSUE"
            title="Edit Issue"
            back={{ href: `/dashboard/crm/projects/issues/${id}`, label: 'Back to issue' }}
        >
            <IssueForm
                mode="edit"
                initial={{
                    _id: String(i._id),
                    title: i.title as string | undefined,
                    description: i.description as string | undefined,
                    projectId: i.projectId as string | undefined,
                    status: i.status as string | undefined,
                    priority: i.priority as string | undefined,
                    assigneeId: i.assigneeId as string | undefined,
                    assigneeName: i.assigneeName as string | undefined,
                    reporterId: i.reporterId as string | undefined,
                    reporterName: i.reporterName as string | undefined,
                }}
            />
        </EntityDetailShell>
    );
}
