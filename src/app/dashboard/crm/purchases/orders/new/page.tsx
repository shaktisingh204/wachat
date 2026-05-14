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

import { ShoppingBag } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { PurchaseOrderForm } from '../_components/purchase-order-form';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage() {
  const session = await getSession();
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New purchase order"
        subtitle="Raise a new procurement order for a vendor."
        icon={ShoppingBag}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Purchases', href: '/dashboard/crm/purchases' },
          {
            label: 'Purchase Orders',
            href: '/dashboard/crm/purchases/orders',
          },
          { label: 'New' },
        ]}
      />
      <PurchaseOrderForm
        currentUserId={session?.user?._id ? String(session.user._id) : null}
      />
    </div>
  );
}
