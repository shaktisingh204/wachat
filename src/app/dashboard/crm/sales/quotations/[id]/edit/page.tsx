/**
 * Edit quotation — `/dashboard/crm/sales/quotations/[id]/edit` (§1D.3
 * rebuild — Phase 1.1B Wave 2 partial).
 *
 * Server component. Hydrates the existing quotation, fetches the
 * custom-field definitions, and hands both to the shared
 * `<QuotationForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 *
 * Mirrors `accounts/[accountId]/edit/page.tsx`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { QuotationForm } from '../../_components/quotation-form';
import { getQuotation } from '@/app/actions/crm/quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotationPage({ params }: PageProps) {
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
    <EntityDetailShell
      eyebrow="QUOTATION"
      title={title}
      back={{ href: `/dashboard/crm/sales/quotations/${id}`, label: 'Quotation' }}
    >
      <QuotationForm initial={quotation} customFields={customFields} />
    </EntityDetailShell>
  );
}
