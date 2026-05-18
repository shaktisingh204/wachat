import { redirect } from 'next/navigation';

/**
 * New task page — server wrapper around `<TaskForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { TaskForm } from '../_components/task-form';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="TASK"
            title="New Task"
            back={{ href: '/dashboard/crm/tasks', label: 'Tasks' }}
        >
            <TaskForm />
        </EntityDetailShell>
    );
}
