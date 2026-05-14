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
import { getInvoice, getInvoiceById } from '@/app/actions/crm/invoices.actions';
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

  // Belt-and-braces: also hit getInvoiceById in case the Rust path
  // surfaced an error we want to silently fall through.
  const fallback = invoice ?? (await getInvoiceById(id));
  if (!fallback) notFound();

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${fallback.invoiceNo || 'invoice'}`}
        subtitle="Update invoice details and line items."
        icon={Receipt}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales', href: '/dashboard/crm/sales' },
          { label: 'Invoices', href: '/dashboard/crm/sales/invoices' },
          {
            label: fallback.invoiceNo || 'Invoice',
            href: `/dashboard/crm/sales/invoices/${id}`,
          },
          { label: 'Edit' },
        ]}
      />
      <InvoiceForm
        initial={fallback}
        customFields={customFields}
        redirectTo={`/dashboard/crm/sales/invoices/${id}`}
      />
    </div>
  );
}
