/**
 * Create ticket — `/dashboard/crm/tickets/new`.
 *
 * Server component: fetches the tenant's ticket custom-field definitions
 * once, then hands off to the shared `<TicketForm>` (also used by Edit).
 */

import { LifeBuoy } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { TicketForm } from '../_components/ticket-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const customFields = (await getCustomFieldsFor('ticket')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New ticket"
        subtitle="Log a new customer issue."
        icon={LifeBuoy}
      />
      <TicketForm customFields={customFields} />
    </div>
  );
}
