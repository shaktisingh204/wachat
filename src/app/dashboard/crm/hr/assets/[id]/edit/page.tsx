import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit asset page — server wrapper that loads the asset and passes it as
 * `initialData` to `<AssetForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getAssetById } from '@/app/actions/crm-assets.actions';

import { AssetForm } from '../../_components/asset-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr/assets';

export default async function EditAssetPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: assetId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const asset = await getAssetById(assetId);
    if (!asset) notFound();

    return (
        <EntityDetailShell
            title={`Edit · ${asset.name}`}
            eyebrow="ASSET"
            back={{ href: `${BASE}/${assetId}`, label: 'Asset detail' }}
        >
            <AssetForm initialData={asset} />
        </EntityDetailShell>
    );
}
