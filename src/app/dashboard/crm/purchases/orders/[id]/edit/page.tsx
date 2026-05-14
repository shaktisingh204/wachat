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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${order.poNo || 'purchase order'}`}
        subtitle="Update purchase-order details and line items."
        icon={ShoppingBag}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Purchases', href: '/dashboard/crm/purchases' },
          {
            label: 'Purchase Orders',
            href: '/dashboard/crm/purchases/orders',
          },
          {
            label: order.poNo || 'Purchase order',
            href: `/dashboard/crm/purchases/orders/${id}`,
          },
          { label: 'Edit' },
        ]}
      />
      <PurchaseOrderForm
        initial={order}
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        redirectTo={`/dashboard/crm/purchases/orders/${id}`}
      />
    </div>
  );
}
