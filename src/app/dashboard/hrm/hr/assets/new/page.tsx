import { redirect } from 'next/navigation';

/**
 * New asset page — server wrapper around `<AssetForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { AssetForm } from '../_components/asset-form';

export const dynamic = 'force-dynamic';

export default async function NewAssetPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Asset"
            subtitle="Register a new company-owned asset."
        >
            <AssetForm />
        </EntityListShell>
    );
}
