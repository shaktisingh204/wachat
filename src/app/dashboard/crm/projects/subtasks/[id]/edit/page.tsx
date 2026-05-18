import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit subtask page — server wrapper.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="SUBTASK"
            title={`Edit · ${subtask.title || 'Subtask'}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to subtask' }}
        >
            <SubtaskForm initialData={subtask} />
        </EntityDetailShell>
    );
}
