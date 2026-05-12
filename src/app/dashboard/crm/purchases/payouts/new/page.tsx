/**
 * Create payout — `/dashboard/crm/purchases/payouts/new`.
 *
 * Server component shell that renders the shared <PayoutForm>. No
 * custom-field plumbing here — `'payout'` is NOT in
 * `WsCustomFieldBelongsTo`.
 */

import { Wallet } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { PayoutForm } from '../_components/payout-form';

export const dynamic = 'force-dynamic';

export default function NewPayoutPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New payout"
        subtitle="Log an outgoing vendor payment."
        icon={Wallet}
      />
      <PayoutForm />
    </div>
  );
}
