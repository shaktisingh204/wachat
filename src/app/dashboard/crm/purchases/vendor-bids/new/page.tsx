/**
 * Create vendor bid — `/dashboard/crm/purchases/vendor-bids/new`.
 *
 * Server component shell that hands off to the shared
 * `<VendorBidForm>` (also used by Edit). Vendor Bids have no
 * custom-field panel (the entity isn't registered as a
 * `WsCustomFieldBelongsTo` key), so this route does no extra
 * pre-fetching.
 */

import { Gavel } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { VendorBidForm } from '../_components/vendor-bid-form';

export const dynamic = 'force-dynamic';

export default function NewVendorBidPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New vendor bid"
        subtitle="Record a vendor's response to an open RFQ."
        icon={Gavel}
      />
      <VendorBidForm />
    </div>
  );
}
