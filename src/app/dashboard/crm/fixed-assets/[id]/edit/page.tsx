/**
 * Edit fixed asset — `/dashboard/crm/fixed-assets/[id]/edit`.
 *
 * Hydrates the existing asset and passes it to the shared
 * `<FixedAssetForm>` (re-used from the Create flow). The form submits
 * a PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { FixedAssetForm } from '../../_components/fixed-asset-form';
import { getFixedAsset } from '@/app/actions/crm/fixed-assets.actions';

export const dynamic = 'force-dynamic';

export default async function EditFixedAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { asset } = await getFixedAsset(id);

  if (!asset) notFound();

  const displayName = asset.name || asset.code || 'Fixed asset';

  return (
    <EntityDetailShell
      eyebrow="FIXED ASSET"
      title={`Edit · ${displayName}`}
      back={{ href: `/dashboard/crm/fixed-assets/${id}`, label: 'Back to Asset' }}
    >
      <FixedAssetForm initial={asset} />
    </EntityDetailShell>
  );
}
