/**
 * Create subscription — `/dashboard/crm/sales/subscriptions/new`.
 *
 * Server component shell. Subscriptions are not registered in
 * `WsCustomFieldBelongsTo`, so there is no custom-field hydration step
 * — the form is rendered directly.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { SubscriptionForm } from '../_components/subscription-form';

export const dynamic = 'force-dynamic';

export default function NewSubscriptionPage() {
  return (
    <EntityDetailShell
      eyebrow="SUBSCRIPTION"
      title="New subscription"
      back={{ href: '/dashboard/crm/sales/subscriptions', label: 'Subscriptions' }}
    >
      <SubscriptionForm />
    </EntityDetailShell>
  );
}
