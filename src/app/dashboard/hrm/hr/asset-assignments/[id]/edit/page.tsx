import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit asset assignment page — server wrapper.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getAssetAssignmentById } from '@/app/actions/crm-asset-assignments.actions';

import { AssetAssignmentForm } from '../../_components/asset-assignment-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/asset-assignments';

export default async function EditAssetAssignmentPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const assignment = await getAssetAssignmentById(id);
    if (!assignment) notFound();

    const title = assignment.asset_name || assignment.asset_id;

    return (
        <EntityListShell
            title={`Edit · ${title}`}
            subtitle="Update assignment fields. Changes are revalidated immediately."
        >
            <AssetAssignmentForm initialData={assignment} />
        </EntityListShell>
    );
}
