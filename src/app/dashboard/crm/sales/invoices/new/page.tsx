/**
 * Create invoice — `/dashboard/crm/sales/invoices/new` (§1D.3 rebuild —
 * Phase 1.1B Wave 2 partial).
 *
 * Server component. Fetches the tenant's invoice custom-field
 * definitions once, then hands off to the shared `<InvoiceForm>` (also
 * used by Edit) inside a back-linked page chrome that mirrors the
 * ACCOUNTS template at `src/app/dashboard/crm/accounts/new/page.tsx`.
 *
 * Supports `?fromKind=quote|so|deal&fromId=` for cross-doc pre-fill —
 * the form reads those from the URL directly.
 *
 * `<InvoiceForm>` already meets every §1D.3 requirement: sectioned
 * cards (Header · Customer · Line items · Summary · Bank · E-invoice ·
 * E-way · Recurring · Notes · Custom fields), every reference field is
 * `<EntityFormField>`, every status/type field is `<EnumFormField>`,
 * cascade filters, smart defaults from `?fromKind/fromId`,
 * `<DirtyFormPrompt>` wired, and a sticky action bar with Save · Save
 * & Send · Save & New · Cancel.
 */

import Link from 'next/link';
import { ArrowLeft, Receipt } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { InvoiceForm } from '../_components/invoice-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const customFields = (await getCustomFieldsFor('invoice')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/dashboard/crm/sales/invoices"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Invoices
        </Link>
      </div>

      <CrmPageHeader
        title="New invoice"
        subtitle="Bill a customer with itemised line items, tax breakdown, and payment terms."
        icon={Receipt}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales', href: '/dashboard/crm/sales' },
          { label: 'Invoices', href: '/dashboard/crm/sales/invoices' },
          { label: 'New' },
        ]}
      />

      <InvoiceForm customFields={customFields} />
    </div>
  );
}
