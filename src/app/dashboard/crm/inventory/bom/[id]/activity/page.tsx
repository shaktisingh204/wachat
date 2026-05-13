/**
 * BOM activity (audit log) — server route.
 *
 * Linked from the BOM detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'bom'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmBomById } from '@/app/actions/crm-bom.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BomActivityPage({ params }: PageProps) {
  const { id } = await params;
  const bom = await getCrmBomById(id);
  if (!bom) notFound();

  const title = bom.bomNo || bom.finishedGoodName || 'BOM';

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title={`${title} — Activity`}
        subtitle="Audit trail of changes made to this BOM."
      />
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
    </div>
  );
}
