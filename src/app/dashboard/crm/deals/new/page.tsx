import { Trophy } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { DealForm } from '../_components/deal-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewDealPage() {
  const customFields = (await getCustomFieldsFor('deal')) as WsCustomField[];
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader title="New deal" subtitle="Capture a new sales opportunity." icon={Trophy} />
      <DealForm customFields={customFields} />
    </div>
  );
}
