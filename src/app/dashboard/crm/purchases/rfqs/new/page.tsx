/**
 * Create RFQ — `/dashboard/crm/purchases/rfqs/new`.
 *
 * Server component shell that hands off to the shared `<RfqForm>` (also
 * used by Edit). RFQs have no custom-field panel (the entity isn't
 * registered as a `WsCustomFieldBelongsTo` key), so this route does no
 * extra pre-fetching.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RfqForm } from '../_components/rfq-form';

export const dynamic = 'force-dynamic';

export default function NewRfqPage() {
  return (
    <EntityListShell title="New RFQ" subtitle="Invite vendors to bid on a list of items.">
      <RfqForm />
    </EntityListShell>
  );
}
