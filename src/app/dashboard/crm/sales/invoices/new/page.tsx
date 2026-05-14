/**
 * Create invoice — `/dashboard/crm/sales/invoices/new`.
 *
 * Server component: fetches the tenant's invoice custom-field definitions
 * once, then hands off to the shared `<InvoiceForm>` (also used by Edit).
 *
 * Supports `?fromKind=quote|so|deal&fromId=` for cross-doc pre-fill —
 * the form reads those from the URL directly.
 */

import { Receipt } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { InvoiceForm } from '../_components/invoice-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const customFields = (await getCustomFieldsFor('invoice')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New invoice"
        subtitle="Bill a customer with itemized line items."
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
