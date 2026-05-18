/**
 * Production-order activity (audit log) — server route per §1D.2.
 *
 * Linked from the production-order detail page's Activity action.
 * Renders the shared `<EntityAuditTimeline>` for the
 * `entityKind: 'production_order'` audit stream.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getProductionOrderById } from '@/app/actions/crm-production-orders.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function ProductionOrderActivityPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getProductionOrderById(orderId);
  if (!order) notFound();

  const title = order.orderNo || 'Production order';

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title={`${title} — Activity`}
        subtitle="Audit trail of status changes, yield updates and edits for this production order."
      />
      <EntityDetailShell
        title={title}
        eyebrow="PRODUCTION ORDER ACTIVITY"
        back={{
          href: `/dashboard/crm/inventory/production-orders/${orderId}`,
          label: 'Back to order',
        }}
      >
        <EntityAuditTimeline entityKind="production_order" entityId={orderId} />
      </EntityDetailShell>
    </div>
  );
}
