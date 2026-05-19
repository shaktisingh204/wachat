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

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditIssuePage({ params }: PageProps) {
    const { id } = await params;
    const issue = await getIssueById(id);
    if (!issue) notFound();
    const i = issue as Record<string, unknown> & { _id: string };

    const subtasksRaw = i.subtasks;
    const subtasks =
        Array.isArray(subtasksRaw)
            ? (subtasksRaw as Record<string, unknown>[]).map((s) => ({
                  id: String(s.id ?? ''),
                  title: String(s.title ?? ''),
                  assigneeId:
                      s.assigneeId !== undefined && s.assigneeId !== null
                          ? String(s.assigneeId)
                          : undefined,
                  assigneeName:
                      s.assigneeName !== undefined && s.assigneeName !== null
                          ? String(s.assigneeName)
                          : undefined,
                  status: String(s.status ?? 'todo'),
                  dueDate:
                      s.dueDate !== undefined && s.dueDate !== null
                          ? String(s.dueDate).slice(0, 10)
                          : undefined,
              }))
            : undefined;

    const attachmentsRaw = i.attachments;
    const attachments =
        Array.isArray(attachmentsRaw)
            ? (attachmentsRaw as Record<string, unknown>[]).map((a) => ({
                  id: String(a.id ?? ''),
                  url: String(a.url ?? ''),
                  name: String(a.name ?? ''),
                  mime:
                      a.mime !== undefined && a.mime !== null
                          ? String(a.mime)
                          : undefined,
                  size:
                      typeof a.size === 'number'
                          ? a.size
                          : a.size != null
                            ? Number(a.size)
                            : undefined,
              }))
            : undefined;

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
                    _id: String(i._id),
                    title: i.title as string | undefined,
                    description: i.description as string | undefined,
                    projectId:
                        i.projectId !== undefined && i.projectId !== null
                            ? String(i.projectId)
                            : undefined,
                    status: i.status as string | undefined,
                    priority: i.priority as string | undefined,
                    severity: i.severity as string | undefined,
                    issueType: i.issueType as string | undefined,
                    assigneeId:
                        (i.assigneeId as string | undefined) ??
                        (i.assigneeUserId != null
                            ? String(i.assigneeUserId)
                            : undefined),
                    assigneeName: i.assigneeName as string | undefined,
                    reporterId:
                        (i.reporterId as string | undefined) ??
                        (i.reporterUserId != null
                            ? String(i.reporterUserId)
                            : undefined),
                    reporterName: i.reporterName as string | undefined,
                    dueDate:
                        i.dueDate !== undefined && i.dueDate !== null
                            ? String(i.dueDate).slice(0, 10)
                            : undefined,
                    estimatedHours:
                        typeof i.estimatedHours === 'number'
                            ? i.estimatedHours
                            : i.estimatedHours != null
                              ? Number(i.estimatedHours)
                              : undefined,
                    subtasks,
                    attachments,
                }}
            />
        </EntityDetailShell>
    );
}
