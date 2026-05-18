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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { InvoiceForm } from '../_components/invoice-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage() {
  const customFields = (await getCustomFieldsFor('invoice')) as WsCustomField[];

  return (
    <EntityDetailShell
      eyebrow="INVOICE"
      title="New invoice"
      back={{ href: '/dashboard/crm/sales/invoices', label: 'Invoices' }}
    >
      <InvoiceForm customFields={customFields} />
    </EntityDetailShell>
  );
}
