/**
 * /dashboard/crm/inventory/production-orders/[orderId]/edit — hydrates
 * the shared <PoForm /> in edit mode.
 */

import { notFound } from 'next/navigation';

import { getProductionOrderById } from '@/app/actions/crm-production-orders.actions';
import { PoForm, type PoFormInitial } from '../../_components/po-form';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function EditProductionOrderPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getProductionOrderById(orderId);
  if (!order) notFound();

  const initial: PoFormInitial = {
    _id: String((order as any)._id),
    orderNo: order.orderNo,
    bomRef: order.bomRef,
    bomId:
      order.bomId && typeof order.bomId !== 'string'
        ? (order.bomId as any).toString?.()
        : order.bomId,
    finishedGoodId:
      order.finishedGoodId && typeof order.finishedGoodId !== 'string'
        ? (order.finishedGoodId as any).toString?.()
        : order.finishedGoodId,
    finishedGoodName: order.finishedGoodName,
    plannedQty: order.plannedQty,
    unit: order.unit,
    plannedStart: order.plannedStart,
    plannedEnd: order.plannedEnd,
    machineId: order.machineId,
    machineOperator: order.machineOperator,
    machineOperatorId:
      order.machineOperatorId && typeof order.machineOperatorId !== 'string'
        ? (order.machineOperatorId as any).toString?.()
        : order.machineOperatorId,
    notes: order.notes,
    status: order.status,
    components: order.components ?? [],
    labourCost: order.labourCost,
    overheadCost: order.overheadCost,
  };

  return <PoForm initial={initial} />;
}
