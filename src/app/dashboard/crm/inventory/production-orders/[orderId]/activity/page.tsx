/**
 * Production-order activity (audit log) — server route per §1D.2.
 *
 * Linked from the production-order detail page's Activity action.
 * Renders the shared `<EntityAuditTimeline>` for the
 * `entityKind: 'production_order'` audit stream.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getProductionOrderById } from '@/app/actions/crm-production-orders.actions';
import { Skeleton } from '@/components/zoruui';

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
    <EntityDetailShell
      title={title}
      eyebrow="PRODUCTION ORDER ACTIVITY"
      back={{
        href: `/dashboard/crm/inventory/production-orders/${orderId}`,
        label: 'Back to order',
      }}
    >
      <Suspense
        fallback={
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        }
      >
        <EntityAuditTimeline entityKind="production_order" entityId={orderId} />
      </Suspense>
    </EntityDetailShell>
  );
}
