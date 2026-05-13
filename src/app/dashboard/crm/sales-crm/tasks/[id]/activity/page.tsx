/**
 * Task activity (audit log) — server route.
 *
 * Mirrors the accounts/[accountId]/activity pattern. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'task'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmTaskById } from '@/app/actions/crm-tasks.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TaskActivityPage({ params }: PageProps) {
    const { id } = await params;
    const task = await getCrmTaskById(id);
    if (!task) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${task.title} — Activity`}
                subtitle="Audit trail of changes made to this task."
            />
            <EntityDetailShell
                title={task.title || 'Task'}
                eyebrow="TASK ACTIVITY"
                back={{
                    href: `/dashboard/crm/sales-crm/tasks/${id}`,
                    label: 'Back to task',
                }}
            >
                <EntityAuditTimeline entityKind="task" entityId={id} />
            </EntityDetailShell>
        </div>
    );
}
