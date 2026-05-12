/**
 * Edit invoice — `/dashboard/crm/sales/invoices/[id]/edit`.
 *
 * Hydrates the existing invoice, fetches custom-field definitions, and
 * passes both to the shared `<InvoiceForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';
import { Receipt } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { InvoiceForm } from '../../_components/invoice-form';
import { getInvoice } from '@/app/actions/crm/invoices.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ invoice }, customFields] = await Promise.all([
    getInvoice(id),
    getCustomFieldsFor('invoice') as Promise<WsCustomField[]>,
  ]);

  if (!invoice) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${invoice.invoiceNo || 'invoice'}`}
        subtitle="Update invoice details and line items."
        icon={Receipt}
      />
      <InvoiceForm initial={invoice} customFields={customFields} />
    </div>
  );
}
