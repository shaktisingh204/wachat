/**
 * BOM activity (audit log) — server route.
 *
 * Linked from the BOM detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'bom'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmBomById } from '@/app/actions/crm-bom.actions';
import { withTimeout } from '../../lib/timeout';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BomActivityPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await withTimeout(getCrmBomById(id), 10000);
  if (!bom) notFound();

  const title = bom.bomNo || bom.finishedGoodName || 'BOM';

  return (
    <EntityDetailShell
      title={title}
      eyebrow="BOM ACTIVITY"
      back={{
        href: `/dashboard/crm/inventory/bom/${id}`,
        label: 'Back to BOM',
      }}
    >
      <EntityAuditTimeline entityKind="bom" entityId={id} />
    </EntityDetailShell>
  );
}
