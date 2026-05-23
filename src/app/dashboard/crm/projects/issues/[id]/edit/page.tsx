import { notFound } from 'next/navigation';

/**
 * Edit issue — §1B W7 (deepened §3.3.2).
 *
 * Renders the shared <IssueForm/> wrapped in <EntityDetailShell/> with an
 * activity rail in the right column.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getIssueById } from '@/app/actions/worksuite/meta.actions';

import { IssueForm } from '../../_components/issue-form';
import { issueSchema } from '../../schema';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditIssuePage({ params }: PageProps) {
    const { id } = await params;
    const issue = await getIssueById(id);
    if (!issue) notFound();
    
    const parsedIssue = issueSchema.parse(issue);

    return (
        <EntityDetailShell
            eyebrow="ISSUE"
            title="Edit Issue"
            back={{
                href: `/dashboard/crm/projects/issues/${id}`,
                label: 'Back to issue',
            }}
            rightRail={
                <EntityAuditTimeline
                    entityKind="issue"
                    entityId={String(id)}
                    title="Activity"
                    limit={25}
                />
            }
        >
            <IssueForm
                mode="edit"
                initial={{
                    _id: parsedIssue._id,
                    title: parsedIssue.title,
                    description: parsedIssue.description || undefined,
                    projectId: parsedIssue.projectId || undefined,
                    status: parsedIssue.status,
                    priority: parsedIssue.priority || undefined,
                    severity: parsedIssue.severity || undefined,
                    issueType: parsedIssue.issueType || undefined,
                    assigneeId: parsedIssue.assigneeId || parsedIssue.assigneeUserId || undefined,
                    assigneeName: parsedIssue.assigneeName || undefined,
                    reporterId: parsedIssue.reporterId || parsedIssue.reporterUserId || undefined,
                    reporterName: parsedIssue.reporterName || undefined,
                    dueDate: parsedIssue.dueDate || undefined,
                    estimatedHours: parsedIssue.estimatedHours || undefined,
                    subtasks: parsedIssue.subtasks || undefined,
                    attachments: parsedIssue.attachments || undefined,
                }}
            />
        </EntityDetailShell>
    );
}
