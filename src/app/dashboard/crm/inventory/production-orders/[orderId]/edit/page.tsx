import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Suspense } from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getProductionOrderById } from '@/app/actions/crm-production-orders.actions';
import { PoForm, type PoFormInitial } from '../../_components/po-form';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  const order = await getProductionOrderById(orderId);
  
  if (!order) {
    return {
      title: 'Production Order Not Found',
    };
  }

  return {
    title: `Edit ${order.orderNo} | SabNode`,
    description: `Edit settings and details for production order ${order.orderNo}`,
  };
}

export const dynamic = 'force-dynamic';

export default async function EditProductionOrderPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getProductionOrderById(orderId);
  if (!order) notFound();

  const initial: PoFormInitial = {
    _id: String(order._id),
    orderNo: order.orderNo,
    bomRef: order.bomRef,
    bomId: order.bomId ? String(order.bomId) : undefined,
    finishedGoodId: order.finishedGoodId ? String(order.finishedGoodId) : undefined,
    finishedGoodName: order.finishedGoodName,
    plannedQty: order.plannedQty,
    unit: order.unit,
    plannedStart: order.plannedStart,
    plannedEnd: order.plannedEnd,
    machineId: order.machineId,
    machineOperator: order.machineOperator,
    machineOperatorId: order.machineOperatorId ? String(order.machineOperatorId) : undefined,
    notes: order.notes,
    status: order.status,
    components: order.components ?? [],
    labourCost: order.labourCost,
    overheadCost: order.overheadCost,
  };

  return (
    <EntityDetailShell
      eyebrow="PRODUCTION ORDER"
      title={`Edit ${order.orderNo}`}
      back={{ href: `/dashboard/crm/inventory/production-orders/${orderId}`, label: 'Back to order details' }}
    >
      <Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-zoru-primary border-t-transparent rounded-full"></div></div>}>
        <PoForm initial={initial} />
      </Suspense>
    </EntityDetailShell>
  );
}
