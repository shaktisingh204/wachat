import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, ListChecks } from 'lucide-react';

/**
 * New subtask page — server wrapper around `<SubtaskForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';

import { SubtaskForm } from '../_components/subtask-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/subtasks';

export default async function NewSubtaskPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_subtask', 'create');
    if (!allowed) redirect(BASE);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Projects', href: '/dashboard/crm/projects' },
                    { label: 'Subtasks', href: BASE },
                    { label: 'New' },
                ]}
                title="New Subtask"
                subtitle="Split a parent task into a smaller actionable item."
                icon={ListChecks}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to subtasks
                        </Link>
                    </ZoruButton>
                }
            />

            <SubtaskForm />
        </div>
    );
}
