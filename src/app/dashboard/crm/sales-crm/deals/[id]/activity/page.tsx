/**
 * Deal activity — `/dashboard/crm/sales-crm/deals/[id]/activity`.
 *
 * Server route. Mirrors the accounts-activity template: fetches the deal
 * for context then renders the shared <EntityAuditTimeline />.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCrmDealById } from '@/app/actions/crm-deals.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DealActivityPage({ params }: PageProps) {
  const { id } = await params;
  const deal = await getCrmDealById(id);
  if (!deal) notFound();

  return (
    <EntityDetailShell
      title={deal.name || 'Deal'}
      eyebrow="DEAL ACTIVITY"
      back={{
        href: `/dashboard/crm/sales-crm/deals/${id}`,
        label: 'Back to deal',
      }}
    >
      <EntityAuditTimeline entityKind="deal" entityId={id} />
    </EntityDetailShell>
  );
}
