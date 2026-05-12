/**
 * Create quotation — `/dashboard/crm/sales/quotations/new`.
 *
 * Server component: fetches the tenant's quotation custom-field
 * definitions once, then hands off to the shared `<QuotationForm>`
 * (also used by Edit).
 */

import { FileText } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { QuotationForm } from '../_components/quotation-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewQuotationPage() {
  const customFields = (await getCustomFieldsFor('quotation')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New quotation"
        subtitle="Draft a new sales quotation."
        icon={FileText}
      />
      <QuotationForm customFields={customFields} />
    </div>
  );
}
