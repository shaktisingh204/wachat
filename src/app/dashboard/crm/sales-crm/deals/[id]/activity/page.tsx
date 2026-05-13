/**
 * Deal activity — `/dashboard/crm/sales-crm/deals/[id]/activity`.
 *
 * Server route. Mirrors the accounts-activity template: fetches the deal
 * for context then renders the shared <EntityAuditTimeline />.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <Link
        href={`/dashboard/crm/sales-crm/deals/${id}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to deal
      </Link>

      <CrmPageHeader
        title={`${deal.name || 'Deal'} — Activity`}
        subtitle="Audit trail of every change made to this deal."
        icon={Activity}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales CRM', href: '/dashboard/crm/sales-crm' },
          { label: 'Deals', href: '/dashboard/crm/sales-crm/deals' },
          { label: deal.name || 'Deal', href: `/dashboard/crm/sales-crm/deals/${id}` },
          { label: 'Activity' },
        ]}
      />

      <EntityAuditTimeline entityKind="deal" entityId={id} />
    </div>
  );
}
