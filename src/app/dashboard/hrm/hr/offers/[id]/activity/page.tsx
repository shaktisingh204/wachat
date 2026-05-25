export const dynamic = 'force-dynamic';
/**
 * Offer activity — server-rendered audit timeline.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getOfferLetterById } from '@/app/actions/hr.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OfferActivityPage({ params }: PageProps) {
  const { id } = await params;
  const o = await getOfferLetterById(id);
  if (!o) notFound();

  return (
    <EntityDetailShell
      title={`Offer · ${(o as any).designation || ''}`}
      eyebrow="OFFER ACTIVITY"
      back={{ href: `/dashboard/hrm/hr/offers/${id}`, label: 'Back to offer' }}
    >
      <EntityAuditTimeline entityKind="offerLetter" entityId={id} />
    </EntityDetailShell>
  );
}
