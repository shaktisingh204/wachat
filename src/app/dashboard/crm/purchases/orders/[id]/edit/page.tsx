/**
 * Edit purchase order — `/dashboard/crm/purchases/orders/[id]/edit`.
 *
 * Hydrates the existing PO and passes it to the shared
 * `<PurchaseOrderForm>` (re-used from the Create flow). The form
 * submits a PATCH because `_id` is rendered as a hidden input.
 *
 * Purchase Orders skip the custom-field panel — `'purchaseOrder'` is
 * not a registered `WsCustomFieldBelongsTo` key.
 */

import { notFound } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { PurchaseOrderForm } from '../../_components/purchase-order-form';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';

export const dynamic = 'force-dynamic';

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { order } = await getPurchaseOrder(id);

  if (!order) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${order.poNo || 'purchase order'}`}
        subtitle="Update purchase-order details."
        icon={ShoppingBag}
      />
      <PurchaseOrderForm initial={order} />
    </div>
  );
}
