/**
 * Purchase order activity — `/dashboard/crm/purchases/orders/[id]/activity`.
 *
 * Mirrors the accounts/[accountId]/activity template. Fetches the PO
 * for header context, then renders the shared `<EntityAuditTimeline>`
 * for `entityKind: 'purchaseOrder'`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderActivityPage({ params }: PageProps) {
  const { id } = await params;
  const { order } = await getPurchaseOrder(id);
  if (!order) notFound();

  const title = order.poNo || `Purchase order ${id.slice(-6)}`;

  return (
    <EntityDetailShell
      eyebrow="PURCHASE ORDER"
      title={`${title} — Activity`}
      subtitle="Audit trail of every change made to this purchase order."
      back={{ href: `/dashboard/crm/purchases/orders/${id}`, label: 'Purchase order' }}
    >
      <EntityAuditTimeline entityKind="purchaseOrder" entityId={id} />
    </EntityDetailShell>
  );
}
