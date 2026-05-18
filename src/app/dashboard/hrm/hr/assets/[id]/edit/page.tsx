import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Package } from 'lucide-react';

/**
 * Edit asset page — server wrapper that loads the asset and passes it as
 * `initialData` to `<AssetForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Assets', href: BASE },
                    { label: asset.name, href: `${BASE}/${assetId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${asset.name}`}
                subtitle="Update asset fields. Changes are revalidated immediately."
                icon={Package}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${assetId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <AssetForm initialData={asset} />
        </div>
    );
}
