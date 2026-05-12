/**
 * Create GRN — `/dashboard/crm/inventory/grn/new`.
 *
 * Server component shell that hands off to the shared `<GrnForm>`
 * (also used by Edit). GRNs have no custom-field panel (`'grn'` is not
 * registered as a `WsCustomFieldBelongsTo` key), so this route does no
 * extra pre-fetching.
 */

import { PackageCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { GrnForm } from '../_components/grn-form';

export const dynamic = 'force-dynamic';

export default function NewGrnPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New GRN"
        subtitle="Record goods received from a vendor against a purchase order."
        icon={PackageCheck}
      />
      <GrnForm />
    </div>
  );
}
