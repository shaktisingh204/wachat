import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit task — server wrapper around `<TaskForm initialData={...} />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getTaskById } from '@/app/actions/crm-tasks-rust.actions';

import { TaskForm } from '../../_components/task-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tasks';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditTaskPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const task = await getTaskById(id);
    if (!task) notFound();

    return (
        <EntityDetailShell
            eyebrow="TASK"
            title={`Edit · ${task.title}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to task' }}
        >
            <TaskForm initialData={task} />
        </EntityDetailShell>
    );
}
