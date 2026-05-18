/**
 * Quotation activity (audit log) — server route (§1D.2 rebuild — Phase
 * 1.1B Wave 2 partial).
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'quotation'`, wrapped in the
 * shared <EntityDetailShell> for consistent navigation chrome.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getQuotation } from '@/app/actions/crm/quotations.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function QuotationActivityPage({ params }: PageProps) {
  const { id } = await params;
  const { quotation } = await getQuotation(id);
  if (!quotation) notFound();

  const title = quotation.quotationNo
    ? `${quotation.quotationNo} — Activity`
    : `Quotation ${id.slice(-6)} — Activity`;

  return (
    <EntityDetailShell
      title={title}
      eyebrow="QUOTATION ACTIVITY"
      back={{
        href: `/dashboard/crm/sales/quotations/${id}`,
        label: 'Back to quotation',
      }}
    >
      <EntityAuditTimeline entityKind="quotation" entityId={id} />
    </EntityDetailShell>
  );
}
