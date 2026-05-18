/**
 * Invoice activity (audit log) — server route (§1D.2 rebuild — Phase
 * 1.1B Wave 2 partial).
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'invoice'`, wrapped in the
 * shared <EntityDetailShell> for consistent navigation chrome.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getInvoice } from '@/app/actions/crm/invoices.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function InvoiceActivityPage({ params }: PageProps) {
  const { id } = await params;
  const { invoice } = await getInvoice(id);
  if (!invoice) notFound();

  const title = invoice.invoiceNo || `Invoice ${id.slice(-6)}`;

  return (
    <EntityDetailShell
      title={`${title} — Activity`}
      eyebrow="INVOICE ACTIVITY"
      back={{
        href: `/dashboard/crm/sales/invoices/${id}`,
        label: 'Back to invoice',
      }}
    >
      <EntityAuditTimeline entityKind="invoice" entityId={id} />
    </EntityDetailShell>
  );
}
