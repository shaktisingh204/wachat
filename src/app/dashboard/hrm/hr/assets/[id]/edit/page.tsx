import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit asset page — server wrapper that loads the asset and passes it as
 * `initialData` to `<AssetForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getAssetById } from '@/app/actions/crm-assets.actions';

import { AssetForm } from '../../_components/asset-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/assets';

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
        <EntityListShell
            title={`Edit · ${asset.name}`}
            subtitle="Update asset fields. Changes are revalidated immediately."
        >
            <AssetForm initialData={asset} />
        </EntityListShell>
    );
}
