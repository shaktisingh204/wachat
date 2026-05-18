import { redirect } from 'next/navigation';

/**
 * New milestone page — server wrapper around `<MilestoneForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';

import { MilestoneForm } from '../_components/milestone-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/milestones';

export default async function NewMilestonePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_milestone', 'create');
    if (!allowed) redirect(BASE);

    return (
        <EntityDetailShell
            eyebrow="MILESTONE"
            title="New Milestone"
            back={{ href: BASE, label: 'Milestones' }}
        >
            <MilestoneForm />
        </EntityDetailShell>
    );
}
