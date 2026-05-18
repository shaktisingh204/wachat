/**
 * Create purchase order — `/dashboard/crm/purchases/orders/new`.
 *
 * Server component shell that hands off to the shared
 * `<PurchaseOrderForm>` (also used by Edit). Reads the session user id
 * so the form can default the "requested by" picker on the approval
 * workflow section.
 *
 * Supports `?fromKind=vendorBid|rfq&fromId=` for cross-doc pre-fill —
 * the form reads those from the URL directly.
 *
 * Purchase Orders have no custom-field panel (the entity isn't
 * registered as a `WsCustomFieldBelongsTo` key), so this route does no
 * extra pre-fetching beyond the session.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PurchaseOrderForm } from '../_components/purchase-order-form';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage() {
  const session = await getSession();
  return (
    <EntityListShell title="New purchase order" subtitle="Raise a new procurement order for a vendor.">
      <PurchaseOrderForm
        currentUserId={session?.user?._id ? String(session.user._id) : null}
      />
    </EntityListShell>
  );
}
