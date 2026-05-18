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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/crm/sales/quotations/${id}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to quotation
        </Link>
      </div>

      <CrmPageHeader
        title={title}
        subtitle="Update quotation details, line items, and terms."
        icon={FileText}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales', href: '/dashboard/crm/sales' },
          { label: 'Quotations', href: '/dashboard/crm/sales/quotations' },
          {
            label: quotation.quotationNo,
            href: `/dashboard/crm/sales/quotations/${id}`,
          },
          { label: 'Edit' },
        ]}
      />

      <QuotationForm initial={quotation} customFields={customFields} />
    </div>
  );
}
