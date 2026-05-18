import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  ListChecks } from 'lucide-react';

/**
 * Edit subtask page — server wrapper.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getSubtaskById } from '@/app/actions/crm-subtasks.actions';

import { SubtaskForm } from '../../_components/subtask-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/subtasks';

export default async function EditSubtaskPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_subtask', 'update');
    if (!allowed) redirect(`${BASE}/${id}`);

    const subtask = await getSubtaskById(id);
    if (!subtask) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Projects', href: '/dashboard/crm/projects' },
                    { label: 'Subtasks', href: BASE },
                    {
                        label: subtask.title || 'Subtask',
                        href: `${BASE}/${id}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${subtask.title || 'Subtask'}`}
                subtitle="Update subtask fields."
                icon={ListChecks}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <SubtaskForm initialData={subtask} />
        </div>
    );
}
