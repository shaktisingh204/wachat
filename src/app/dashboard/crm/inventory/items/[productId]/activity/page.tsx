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
      <EntityAuditTimeline entityKind="item" entityId={productId} />
    </EntityDetailShell>
  );
}
