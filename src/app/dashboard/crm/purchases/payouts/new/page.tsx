/**
 * Create payout — `/dashboard/crm/purchases/payouts/new`.
 *
 * Server component shell that renders the shared <PayoutForm>.
 *
 * Convert flow: when invoked with `?fromKind=bill&fromId=…`, we hydrate
 * the parent bill via `getCrmEntityForPrefill` and seed the form with
 * `vendorId`, `currency`, and a single apply-row referencing the bill
 * outstanding amount (the form's unpaid-bill lookup will refresh this
 * too, but seeding makes the first paint correct without a roundtrip).
 *
 * No custom-field plumbing here — `'payout'` is NOT in
 * `WsCustomFieldBelongsTo`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PayoutForm } from '../_components/payout-form';
import { getCrmEntityForPrefill } from '@/lib/crm/convert-with-prefill';
import type { CrmBillDoc } from '@/lib/rust-client/crm-bills';
import type { CrmPayoutDoc } from '@/lib/rust-client/crm-payouts';

export const dynamic = 'force-dynamic';

interface NewPayoutSearch {
  fromKind?: string;
  fromId?: string;
}

/** Project a parent bill into the payout-form `initial` shape. */
function billToPayoutSeed(bill: CrmBillDoc): Partial<CrmPayoutDoc> {
  const outstanding =
    typeof bill.balance === 'number'
      ? Math.max(0, bill.balance)
      : Math.max(
          0,
          Number(bill.totals?.total ?? 0) - Number(bill.amountPaid ?? 0),
        );
  return {
    vendorId: bill.vendorId,
    currency: bill.currency ?? 'INR',
    amount: outstanding,
    applyTo: [{ billId: String(bill._id), amount: outstanding }],
  };
}

export default async function NewPayoutPage({
  searchParams,
}: {
  searchParams: Promise<NewPayoutSearch>;
}) {
  const sp = await searchParams;
  const parent = await getCrmEntityForPrefill<CrmBillDoc>(sp.fromKind, sp.fromId);

  const initial =
    parent && (sp.fromKind ?? '').trim() === 'bill'
      ? (billToPayoutSeed(parent) as CrmPayoutDoc)
      : undefined;

  return (
    <EntityListShell
      title="New payout"
      subtitle={
        initial
          ? 'Pre-filled from a vendor bill — confirm and save.'
          : 'Log an outgoing vendor payment.'
      }
    >
      <PayoutForm initial={initial} />
    </EntityListShell>
  );
}
