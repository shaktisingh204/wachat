/**
 * Edit payout — `/dashboard/crm/purchases/payouts/[id]/edit`.
 *
 * Hydrates the existing payout and passes it to the shared <PayoutForm>
 * (re-used from the Create flow). The form submits a PATCH because
 * `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { Wallet } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { PayoutForm } from '../../_components/payout-form';
import { getPayout } from '@/app/actions/crm/payouts.actions';

export const dynamic = 'force-dynamic';

export default async function EditPayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { payout } = await getPayout(id);

  if (!payout) notFound();

  const title = payout.paymentNo || String(payout._id);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${title}`}
        subtitle="Update payout details."
        icon={Wallet}
      />
      <PayoutForm initial={payout} />
    </div>
  );
}
