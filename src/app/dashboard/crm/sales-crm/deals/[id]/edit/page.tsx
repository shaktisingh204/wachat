/**
 * Edit Deal — `/dashboard/crm/sales-crm/deals/[id]/edit`.
 *
 * Server component. Fetches the deal then renders the shared <DealForm />
 * with `initial` pre-loaded. Per CRM_REBUILD_PLAN §1D.3 — the edit
 * surface is the same form as `/new`.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmDealById } from '@/app/actions/crm-deals.actions';
import { DealForm } from '../../_components/deal-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDealPage({ params }: PageProps) {
  const { id } = await params;
  const deal = await getCrmDealById(id);
  if (!deal) notFound();

  return (
    <EntityListShell
      title={`Edit ${deal.name || 'deal'}`}
      subtitle="Update deal details and pipeline placement."
    >
      <DealForm
        initial={deal}
        redirectTo={`/dashboard/crm/sales-crm/deals/${id}`}
      />
    </EntityListShell>
  );
}
