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

import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getQuotation } from '@/app/actions/crm/quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { EditQuotationClient } from './edit-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotationPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const [quotationResult, customFields] = await Promise.all([
    getQuotation(id),
    getCustomFieldsFor('quotation') as Promise<WsCustomField[]>,
  ]);

  const { quotation, error } = quotationResult;

  if (error || !quotation) {
    return (
      <EntityDetailShell
        eyebrow="QUOTATION ERROR"
        title="Error loading quotation"
        back={{ href: `/dashboard/crm/sales/quotations`, label: 'Quotations' }}
      >
        <div className="p-6 text-center text-zoru-danger-ink bg-zoru-danger-bg rounded-lg border border-zoru-danger">
          <p className="font-semibold text-lg mb-2">Could not load quotation</p>
          <p>{error || 'Quotation not found or you do not have permission to view it.'}</p>
        </div>
      </EntityDetailShell>
    );
  }

  const title = quotation.quotationNo
    ? `Edit ${quotation.quotationNo}`
    : 'Edit quotation';

  return (
    <EntityDetailShell
      eyebrow="QUOTATION"
      title={title}
      back={{ href: `/dashboard/crm/sales/quotations/${id}`, label: 'Quotation' }}
    >
      <EditQuotationClient initial={quotation} customFields={customFields} />
    </EntityDetailShell>
  );
}
