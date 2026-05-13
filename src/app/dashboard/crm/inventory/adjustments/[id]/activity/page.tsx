/**
 * Stock-adjustment activity (audit log) — server route.
 *
 * Linked from the adjustment detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'stock_adjustment'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StockAdjustmentActivityPage({ params }: PageProps) {
  const { id } = await params;
  const adj = await getCrmStockAdjustmentById(id);
  if (!adj) notFound();

  const productName = (adj as any).productName as string | undefined;
  const title = productName
    ? `${productName} (${adj.quantity > 0 ? '+' : ''}${adj.quantity})`
    : `Adjustment #${id.slice(-6)}`;

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title={`${title} — Activity`}
        subtitle="Audit trail of changes made to this stock adjustment."
      />
      <EntityDetailShell
        title={title}
        eyebrow="STOCK ADJUSTMENT ACTIVITY"
        back={{
          href: `/dashboard/crm/inventory/adjustments/${id}`,
          label: 'Back to adjustment',
        }}
      >
        <EntityAuditTimeline entityKind="stock_adjustment" entityId={id} />
      </EntityDetailShell>
    </div>
  );
}
