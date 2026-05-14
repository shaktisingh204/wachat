/**
 * Quotation activity (audit log) — server route. Mirrors
 * `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * `<EntityAuditTimeline>` for `entityKind: 'quotation'`.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Activity, ArrowLeft } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getQuotation } from '@/app/actions/crm/quotations.actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuotationActivityPage({ params }: PageProps) {
  const { id } = await params;
  const { quotation } = await getQuotation(id);
  if (!quotation) notFound();

  const title = quotation.quotationNo
    ? `${quotation.quotationNo} — Activity`
    : `Quotation ${id.slice(-6)} — Activity`;

  return (
    <div className="flex w-full flex-col gap-6">
      <Link
        href={`/dashboard/crm/sales/quotations/${id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to quotation
      </Link>

      <CrmPageHeader
        title={title}
        subtitle="Audit trail of every change made to this quotation."
        icon={Activity}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales', href: '/dashboard/crm/sales' },
          { label: 'Quotations', href: '/dashboard/crm/sales/quotations' },
          {
            label: quotation.quotationNo,
            href: `/dashboard/crm/sales/quotations/${id}`,
          },
          { label: 'Activity' },
        ]}
      />

      <EntityAuditTimeline entityKind="quotation" entityId={id} />
    </div>
  );
}
