/**
 * `/dashboard/crm/sales-crm/tasks/[id]/edit` — server-loaded edit form.
 *
 * Loads the task via `getCrmTaskById`, then hands it to the shared
 * <TaskForm> with `mode="edit"`. The form's action dispatches to
 * `updateCrmTask` instead of `createCrmTask`.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href={`/dashboard/crm/sales-crm/tasks/${id}`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to task
                </Link>
            </div>

            <CrmPageHeader
                title="Edit Task"
                subtitle={`Update the details for "${task.title}".`}
                icon={Edit}
            />

            <TaskForm
                mode="edit"
                initial={task}
                currentUserId={session?.user?._id ? String(session.user._id) : null}
            />
        </div>
    );
}
