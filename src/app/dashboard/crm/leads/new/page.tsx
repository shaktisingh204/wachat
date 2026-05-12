/**
 * Create lead — `/dashboard/crm/leads/new`.
 *
 * Server component: fetches the tenant's lead custom-field definitions
 * once, then hands off to the shared `<LeadForm>` (also used by Edit).
 */

import { Users } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { LeadForm } from '../_components/lead-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewLeadPage() {
  const customFields = (await getCustomFieldsFor('lead')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New lead"
        subtitle="Capture a new sales prospect."
        icon={Users}
      />
      <LeadForm customFields={customFields} />
    </div>
  );
}
