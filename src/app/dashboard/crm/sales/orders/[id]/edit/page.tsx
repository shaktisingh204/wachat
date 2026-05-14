/**
 * Edit sales order — `/dashboard/crm/sales/orders/[id]/edit`.
 *
 * Hydrates the existing sales order and passes it to the shared §1D
 * `<SalesOrdersForm>` (re-used from the Create flow). The form submits
 * a PATCH because `_id` is rendered as a hidden input.
 *
 * No custom-fields round-trip — sales orders skip that pipeline.
 */

import { notFound } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { SalesOrdersForm } from '../../_components/sales-orders-form';
import { getSalesOrder } from '@/app/actions/crm/sales-orders.actions';

export const dynamic = 'force-dynamic';

export default async function EditSalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { order } = await getSalesOrder(id);

  if (!order) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${order.soNo || 'sales order'}`}
        subtitle="Update sales order details."
        icon={ShoppingCart}
      />
      <SalesOrdersForm initial={order} />
    </div>
  );
}
