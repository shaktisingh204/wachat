/**
 * Edit invoice — `/dashboard/crm/sales/invoices/[id]/edit` (§1D.3 rebuild
 * — Phase 1.1B Wave 2 partial).
 *
 * Hydrates the existing invoice, fetches the custom-field definitions,
 * and hands both to the shared `<InvoiceForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a hidden
 * input.
 *
 * Mirrors `accounts/[accountId]/edit/page.tsx`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
    <EntityDetailShell
      eyebrow="INVOICE"
      title={`Edit ${fallback.invoiceNo || 'invoice'}`}
      back={{ href: `/dashboard/crm/sales/invoices/${id}`, label: 'Invoice' }}
    >
      <InvoiceForm
        initial={fallback}
        customFields={customFields}
        redirectTo={`/dashboard/crm/sales/invoices/${id}`}
      />
    </EntityDetailShell>
  );
}
