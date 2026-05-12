/**
 * Edit vendor bid — `/dashboard/crm/purchases/vendor-bids/[id]/edit`.
 *
 * Hydrates the existing bid and passes it to the shared
 * `<VendorBidForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 *
 * Vendor Bids skip the custom-field panel — `'vendorBid'` is not a
 * registered `WsCustomFieldBelongsTo` key.
 */

import { notFound } from 'next/navigation';
import { Gavel } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { VendorBidForm } from '../../_components/vendor-bid-form';
import { getVendorBid } from '@/app/actions/crm/vendor-bids.actions';

export const dynamic = 'force-dynamic';

export default async function EditVendorBidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bid } = await getVendorBid(id);

  if (!bid) notFound();

  const title = bid.vendorName || 'vendor bid';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${title}`}
        subtitle="Update vendor-bid details."
        icon={Gavel}
      />
      <VendorBidForm initial={bid} />
    </div>
  );
}
