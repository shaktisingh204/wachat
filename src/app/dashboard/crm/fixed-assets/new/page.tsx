/**
 * Create fixed asset — `/dashboard/crm/fixed-assets/new`.
 *
 * Server component shell. `fixedAsset` is NOT a member of
 * `WsCustomFieldBelongsTo`, so we deliberately skip the custom-field
 * fetch and hand a bare `<FixedAssetForm>` to the user.
 */

import { Suspense } from 'react';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { FixedAssetForm } from '../_components/fixed-asset-form';

export const dynamic = 'force-dynamic';

export default async function NewFixedAssetPage() {
  return (
    <EntityDetailShell
      eyebrow="FIXED ASSET"
      title="New fixed asset"
      back={{ href: '/dashboard/crm/fixed-assets', label: 'Fixed Assets' }}
    >
      <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--st-text-secondary)]">Loading form...</div>}>
        <FixedAssetForm />
      </Suspense>
    </EntityDetailShell>
  );
}
