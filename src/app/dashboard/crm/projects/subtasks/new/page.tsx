import { redirect } from 'next/navigation';

/**
 * New subtask page — server wrapper around `<SubtaskForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="SUBTASK"
            title="New Subtask"
            back={{ href: BASE, label: 'Subtasks' }}
        >
            <SubtaskForm />
        </EntityDetailShell>
    );
}
