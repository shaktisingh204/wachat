/**
 * Create subscription — `/dashboard/crm/sales/subscriptions/new`.
 *
 * Server component shell. Subscriptions are not registered in
 * `WsCustomFieldBelongsTo`, so there is no custom-field hydration step
 * — the form is rendered directly.
 */

import { Repeat } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { SubscriptionForm } from '../_components/subscription-form';

export const dynamic = 'force-dynamic';

export default function NewSubscriptionPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New subscription"
        subtitle="Set up a new recurring billing agreement."
        icon={Repeat}
      />
      <SubscriptionForm />
    </div>
  );
}
