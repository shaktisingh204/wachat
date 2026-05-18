/**
 * Create vendor bid — `/dashboard/crm/purchases/vendor-bids/new`.
 *
 * Server component shell that hands off to the shared
 * `<VendorBidForm>` (also used by Edit). Vendor Bids have no
 * custom-field panel (the entity isn't registered as a
 * `WsCustomFieldBelongsTo` key), so this route does no extra
 * pre-fetching.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { VendorBidForm } from '../_components/vendor-bid-form';

export const dynamic = 'force-dynamic';

export default function NewVendorBidPage() {
  return (
    <EntityListShell title="New vendor bid" subtitle="Record a vendor's response to an open RFQ.">
      <VendorBidForm />
    </EntityListShell>
  );
}
