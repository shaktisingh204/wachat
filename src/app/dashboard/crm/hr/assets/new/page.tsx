import { redirect } from 'next/navigation';

/**
 * New asset page — server wrapper around `<AssetForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { AssetForm } from '../_components/asset-form';

export const dynamic = 'force-dynamic';

export default async function NewAssetPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New Asset"
            eyebrow="ASSET"
            back={{ href: '/dashboard/crm/hr/assets', label: 'Assets' }}
        >
            <AssetForm />
        </EntityDetailShell>
    );
}
