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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PurchaseOrderForm } from '../../_components/purchase-order-form';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ order }, session] = await Promise.all([
    getPurchaseOrder(id),
    getSession(),
  ]);

  if (!order) notFound();

  return (
    <EntityListShell
      title={`Edit ${order.poNo || 'purchase order'}`}
      subtitle="Update purchase-order details and line items."
    >
      <PurchaseOrderForm
        initial={order}
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        redirectTo={`/dashboard/crm/purchases/orders/${id}`}
      />
    </EntityListShell>
  );
}
