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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { QuotationForm } from '../_components/quotation-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewQuotationPage() {
  const customFields = (await getCustomFieldsFor(
    'quotation',
  )) as WsCustomField[];

  return (
    <EntityDetailShell
      eyebrow="QUOTATION"
      title="New quotation"
      back={{ href: '/dashboard/crm/sales/quotations', label: 'Quotations' }}
    >
      <QuotationForm customFields={customFields} />
    </EntityDetailShell>
  );
}
