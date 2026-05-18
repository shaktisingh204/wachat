import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FolderKanban } from 'lucide-react';

/**
 * Edit task — server wrapper around `<TaskForm initialData={...} />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Tasks', href: BASE },
                    { label: task.title, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${task.title}`}
                subtitle="Update task details, checklist or attachments."
                icon={FolderKanban}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <TaskForm initialData={task} />
        </div>
    );
}
