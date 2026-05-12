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
import { Repeat } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit subscription ${String(subscription._id).slice(-6)}`}
        subtitle="Update billing cadence, plan, or trial window."
        icon={Repeat}
      />
      <SubscriptionForm initial={subscription} />
    </div>
  );
}
