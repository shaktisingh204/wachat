/**
 * Create quotation — `/dashboard/crm/sales/quotations/new`.
 *
 * Server component: fetches the tenant's quotation custom-field
 * definitions, then hands off to the canonical `<QuotationForm>`. The
 * form supports smart defaults from `?fromKind=deal&fromId=…` and
 * `?fromKind=lead&fromId=…` and renders the §1D.3 section layout.
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
