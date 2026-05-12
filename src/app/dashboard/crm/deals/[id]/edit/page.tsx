import { notFound } from 'next/navigation';
import { Trophy } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { DealForm } from '../../_components/deal-form';
import { getDeal } from '@/app/actions/crm/deals.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ deal }, customFields] = await Promise.all([
    getDeal(id),
    getCustomFieldsFor('deal') as Promise<WsCustomField[]>,
  ]);

  if (!deal) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${deal.title}`}
        subtitle="Update deal details."
        icon={Trophy}
      />
      <DealForm initial={deal} customFields={customFields} />
    </div>
  );
}
