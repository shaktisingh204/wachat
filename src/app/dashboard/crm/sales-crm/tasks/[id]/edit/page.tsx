/**
 * `/dashboard/crm/sales-crm/tasks/[id]/edit` — server-loaded edit form.
 *
 * Loads the task via `getCrmTaskById`, then hands it to the shared
 * <TaskForm> with `mode="edit"`. The form's action dispatches to
 * `updateCrmTask` instead of `createCrmTask`.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { TaskForm } from '../../_components/tasks-form';
import { getCrmTaskById } from '@/app/actions/crm-tasks.actions';
import { getSession } from '@/app/actions/user.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTaskPage({ params }: PageProps) {
    const { id } = await params;
    const [task, session] = await Promise.all([
        getCrmTaskById(id),
        getSession(),
    ]);
    if (!task) notFound();

    return (
        <EntityListShell
            title="Edit Task"
            subtitle={`Update the details for "${task.title}".`}
        >
            <TaskForm
                mode="edit"
                initial={task}
                currentUserId={session?.user?._id ? String(session.user._id) : null}
            />
        </EntityListShell>
    );
}
