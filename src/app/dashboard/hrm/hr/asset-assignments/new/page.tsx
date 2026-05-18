import { redirect } from 'next/navigation';

/**
 * New asset assignment page — server wrapper around
 * `<AssetAssignmentForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { AssetAssignmentForm } from '../_components/asset-assignment-form';

export const dynamic = 'force-dynamic';

export default async function NewAssetAssignmentPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New assignment"
            subtitle="Issue an asset to an employee."
        >
            <AssetAssignmentForm />
        </EntityListShell>
    );
}
