/**
 * Invoice activity — `/dashboard/crm/sales/invoices/[id]/activity`.
 *
 * Mirrors the accounts/[accountId]/activity template. Fetches the invoice
 * for header context, then renders the shared `<EntityAuditTimeline>`
 * for `entityKind: 'invoice'`.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
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
    <div className="flex w-full flex-col gap-6">
      <Link
        href={`/dashboard/crm/sales/invoices/${id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoice
      </Link>

      <CrmPageHeader
        title={`${title} — Activity`}
        subtitle="Audit trail of every change made to this invoice."
        icon={Activity}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales', href: '/dashboard/crm/sales' },
          { label: 'Invoices', href: '/dashboard/crm/sales/invoices' },
          { label: title, href: `/dashboard/crm/sales/invoices/${id}` },
          { label: 'Activity' },
        ]}
      />

      <EntityAuditTimeline entityKind="invoice" entityId={id} />
    </div>
  );
}
