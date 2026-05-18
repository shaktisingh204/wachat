/**
 * Create lead — `/dashboard/crm/leads/new`.
 *
 * Server component: fetches the tenant's lead custom-field definitions
 * once, then hands off to the shared `<LeadForm>` (also used by Edit).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { LeadForm } from '../_components/lead-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewLeadPage() {
  const customFields = (await getCustomFieldsFor('lead')) as WsCustomField[];

  return (
    <EntityDetailShell
      eyebrow="LEAD"
      title="New lead"
      back={{ href: '/dashboard/crm/leads', label: 'Leads' }}
    >
      <LeadForm customFields={customFields} />
    </EntityDetailShell>
  );
}
