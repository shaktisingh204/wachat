/**
 * Edit subscription — `/dashboard/crm/sales/subscriptions/[id]/edit`.
 *
 * Hydrates the existing subscription and passes it to the shared
 * `<SubscriptionForm>` (re-used from the Create flow). The form
 * submits a PATCH because `_id` is rendered as a hidden input.
 *
 * Subscriptions are NOT in `WsCustomFieldBelongsTo`; no custom-field
 * fetch step is performed.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { SubscriptionForm } from '../../_components/subscription-form';
import { getSubscription } from '@/app/actions/crm/subscriptions.actions';

export const dynamic = 'force-dynamic';

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { subscription } = await getSubscription(id);

  if (!subscription) notFound();

  return (
    <EntityDetailShell
      eyebrow="SUBSCRIPTION"
      title={`Edit subscription ${String(subscription._id).slice(-6)}`}
      back={{ href: `/dashboard/crm/sales/subscriptions/${id}`, label: 'Subscription' }}
    >
      <SubscriptionForm initial={subscription} />
    </EntityDetailShell>
  );
}
