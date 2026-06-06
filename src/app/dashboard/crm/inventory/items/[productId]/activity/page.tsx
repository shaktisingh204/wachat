/**
 * Inventory item activity (audit log) — server route.
 *
 * Linked from the item detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'item'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmProductById } from '@/app/actions/crm-products.actions';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function InventoryItemActivityPage({ params }: PageProps) {
  const { productId } = await params;
  const product = await getCrmProductById(productId);
  if (!product) notFound();

  return (
    <EntityDetailShell
      title={product.name}
      eyebrow="ITEM ACTIVITY"
      back={{
        href: `/dashboard/crm/inventory/items/${productId}`,
        label: 'Back to item',
      }}
    >
      <Suspense fallback={<ActivityTimelineSkeleton />}>
        <EntityAuditTimeline entityKind="item" entityId={productId} />
      </Suspense>
    </EntityDetailShell>
  );
}

function ActivityTimelineSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
