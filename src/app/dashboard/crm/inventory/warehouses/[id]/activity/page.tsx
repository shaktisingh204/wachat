/**
 * Warehouse activity (audit log) — server route.
 *
 * Linked from the warehouse detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'warehouse'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmWarehouseById } from '@/app/actions/crm-warehouses.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WarehouseActivityPage({ params }: PageProps) {
  const { id } = await params;
  const warehouse = await getCrmWarehouseById(id);
  if (!warehouse) notFound();

  return (
    <EntityDetailShell
      title={warehouse.name}
      eyebrow="WAREHOUSE ACTIVITY"
      back={{
        href: `/dashboard/crm/inventory/warehouses/${id}`,
        label: 'Back to warehouse',
      }}
    >
      <EntityAuditTimeline entityKind="warehouse" entityId={id} />
    </EntityDetailShell>
  );
}
