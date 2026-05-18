/**
 * Create quotation — `/dashboard/crm/sales/quotations/new` (§1D.3 rebuild
 * — Phase 1.1B Wave 2 partial).
 *
 * Server component. Fetches the tenant's quotation custom-field
 * definitions, then hands off to the canonical `<QuotationForm>`. The
 * form supports smart defaults from `?fromKind=deal&fromId=…` and
 * `?fromKind=lead&fromId=…` and renders the §1D.3 section layout
 * (Header · Customer · Line items · Summary · Notes · Terms ·
 * Attachments · Custom fields). Sticky action bar with Save · Save &
 * Send · Save & New · Cancel.
 *
 * Mirrors `accounts/new/page.tsx`.
 */

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { QuotationForm } from '../_components/quotation-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewQuotationPage() {
  const customFields = (await getCustomFieldsFor(
    'quotation',
  )) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/dashboard/crm/sales/quotations"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Quotations
        </Link>
      </div>

      <CrmPageHeader
        title="New quotation"
        subtitle="Draft a new sales quotation with itemised line items."
        icon={FileText}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales', href: '/dashboard/crm/sales' },
          { label: 'Quotations', href: '/dashboard/crm/sales/quotations' },
          { label: 'New' },
        ]}
      />

      <QuotationForm customFields={customFields} />
    </div>
  );
}
