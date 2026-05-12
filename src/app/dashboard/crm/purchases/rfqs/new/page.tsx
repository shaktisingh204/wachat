/**
 * Create RFQ — `/dashboard/crm/purchases/rfqs/new`.
 *
 * Server component shell that hands off to the shared `<RfqForm>` (also
 * used by Edit). RFQs have no custom-field panel (the entity isn't
 * registered as a `WsCustomFieldBelongsTo` key), so this route does no
 * extra pre-fetching.
 */

import { ClipboardList } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { RfqForm } from '../_components/rfq-form';

export const dynamic = 'force-dynamic';

export default function NewRfqPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New RFQ"
        subtitle="Invite vendors to bid on a list of items."
        icon={ClipboardList}
      />
      <RfqForm />
    </div>
  );
}
