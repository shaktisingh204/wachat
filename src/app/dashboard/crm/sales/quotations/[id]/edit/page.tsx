/**
 * Edit quotation — `/dashboard/crm/sales/quotations/[id]/edit`.
 *
 * Hydrates the existing quotation, fetches custom-field definitions,
 * and passes both to the shared `<QuotationForm>` (re-used from the
 * Create flow). The form submits a PATCH because `_id` is rendered as
 * a hidden input.
 */

import { notFound } from 'next/navigation';
import { FileText } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { QuotationForm } from '../../_components/quotation-form';
import { getQuotation } from '@/app/actions/crm/quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ quotation }, customFields] = await Promise.all([
    getQuotation(id),
    getCustomFieldsFor('quotation') as Promise<WsCustomField[]>,
  ]);

  if (!quotation) notFound();

  const title = quotation.quotationNo
    ? `Edit ${quotation.quotationNo}`
    : 'Edit quotation';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle="Update quotation details."
        icon={FileText}
      />
      <QuotationForm initial={quotation} customFields={customFields} />
    </div>
  );
}
