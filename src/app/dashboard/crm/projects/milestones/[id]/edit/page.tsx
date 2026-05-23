import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit milestone page — server wrapper that loads the milestone by id
 * and passes it as `initialData` to `<MilestoneForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { getWsProjectMilestoneById } from '@/app/actions/worksuite/projects.actions';

import { MilestoneForm } from '../../_components/milestone-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/projects/milestones';

export default async function EditMilestonePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const allowed = await canServer('crm_milestone', 'edit');
    if (!allowed) redirect(`${BASE}/${id}`);

    const milestone = await getWsProjectMilestoneById(id);
    if (!milestone) notFound();

    return (
        <EntityDetailShell
            eyebrow="MILESTONE"
            title={`Edit · ${milestone.milestoneTitle}`}
            back={{ href: `${BASE}/${id}`, label: 'Back to milestone' }}
        >
            <MilestoneForm initialData={milestone} />
        </EntityDetailShell>
    );
}
