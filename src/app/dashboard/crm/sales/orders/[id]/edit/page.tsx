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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
    <EntityDetailShell
      eyebrow="SALES ORDER"
      title={`Edit ${order.soNo || 'sales order'}`}
      back={{ href: `/dashboard/crm/sales/orders/${id}`, label: 'Sales Order' }}
    >
      <SalesOrdersForm initial={order} />
    </EntityDetailShell>
  );
}
