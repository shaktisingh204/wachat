/**
 * Create fixed asset — `/dashboard/crm/fixed-assets/new`.
 *
 * Server component shell. `fixedAsset` is NOT a member of
 * `WsCustomFieldBelongsTo`, so we deliberately skip the custom-field
 * fetch and hand a bare `<FixedAssetForm>` to the user.
 */

import { Boxes } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { FixedAssetForm } from '../_components/fixed-asset-form';

export const dynamic = 'force-dynamic';

export default async function NewFixedAssetPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New fixed asset"
        subtitle="Register a new durable asset."
        icon={Boxes}
      />
      <FixedAssetForm />
    </div>
  );
}
