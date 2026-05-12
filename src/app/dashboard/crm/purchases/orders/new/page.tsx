/**
 * Create purchase order — `/dashboard/crm/purchases/orders/new`.
 *
 * Server component shell that hands off to the shared
 * `<PurchaseOrderForm>` (also used by Edit). Purchase Orders have no
 * custom-field panel (the entity isn't registered as a
 * `WsCustomFieldBelongsTo` key), so this route does no extra
 * pre-fetching.
 */

import { ShoppingBag } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { PurchaseOrderForm } from '../_components/purchase-order-form';

export const dynamic = 'force-dynamic';

export default function NewPurchaseOrderPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New purchase order"
        subtitle="Raise a new procurement order for a vendor."
        icon={ShoppingBag}
      />
      <PurchaseOrderForm />
    </div>
  );
}
