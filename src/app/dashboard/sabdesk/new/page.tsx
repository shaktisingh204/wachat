/**
 * Create ticket — `/dashboard/sabdesk/new`.
 *
 * Server component: fetches the tenant's ticket custom-field definitions
 * once, then hands off to the shared `<TicketForm>` (also used by Edit).
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { TicketForm } from '../_components/ticket-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewTicketPage() {
  const customFields = (await getCustomFieldsFor('ticket')) as WsCustomField[];

  return (
    <EntityDetailShell
      eyebrow="TICKET"
      title="New ticket"
      back={{ href: '/dashboard/sabdesk', label: 'Tickets' }}
    >
      <TicketForm customFields={customFields} />
    </EntityDetailShell>
  );
}
