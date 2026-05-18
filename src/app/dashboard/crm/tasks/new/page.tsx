import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  FolderKanban } from 'lucide-react';

/**
 * New task page — server wrapper around `<TaskForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { TaskForm } from '../_components/task-form';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Tasks', href: '/dashboard/crm/tasks' },
                    { label: 'New' },
                ]}
                title="New Task"
                subtitle="Create a task with checklist items, attachments and linked entity."
                icon={FolderKanban}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/tasks">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <TaskForm />
        </div>
    );
}
