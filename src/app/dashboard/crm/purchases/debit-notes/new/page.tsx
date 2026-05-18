/**
 * Create debit note — `/dashboard/crm/purchases/debit-notes/new`.
 *
 * Server component shell. The shared `<DebitNoteForm>` (also used by
 * Edit) handles all interactive bits.
 *
 * Convert flow: when invoked with `?fromKind=bill&fromId=…`, we hydrate
 * the parent bill via `getCrmEntityForPrefill` and seed the form with
 * `vendorId`, `linkedBillId`, `currency`, and the bill's line items
 * (mapped 1:1 — the user can edit qty/rate for short-shipment / return
 * adjustments). No custom fields — `'debitNote'` is not in
 * `WsCustomFieldBelongsTo`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DebitNoteForm } from '../_components/debit-note-form';
import { getCrmEntityForPrefill } from '@/lib/crm/convert-with-prefill';
import type { CrmBillDoc } from '@/lib/rust-client/crm-bills';
import type {
  CrmDebitNoteDoc,
  CrmDebitNoteLineItem,
} from '@/lib/rust-client/crm-debit-notes';

export const dynamic = 'force-dynamic';

interface NewDebitNoteSearch {
  fromKind?: string;
  fromId?: string;
}

/** Project a parent bill into the debit-note-form `initial` shape. */
function billToDebitNoteSeed(bill: CrmBillDoc): Partial<CrmDebitNoteDoc> {
  const items: CrmDebitNoteLineItem[] = (bill.items ?? []).map((li) => ({
    itemId: li.itemId,
    description: li.description,
    hsnSac: li.hsnSac,
    qty: Number(li.qty ?? 0),
    unit: li.unit,
    rate: Number(li.rate ?? 0),
    discountPct: li.discountPct,
    taxRatePct: li.taxRatePct,
    total: Number(li.total ?? 0),
  }));
  return {
    vendorId: bill.vendorId,
    currency: bill.currency ?? 'INR',
    linkedBillId: String(bill._id),
    items,
  };
}

export default async function NewDebitNotePage({
  searchParams,
}: {
  searchParams: Promise<NewDebitNoteSearch>;
}) {
  const sp = await searchParams;
  const parent = await getCrmEntityForPrefill<CrmBillDoc>(sp.fromKind, sp.fromId);

  const initial =
    parent && (sp.fromKind ?? '').trim() === 'bill'
      ? (billToDebitNoteSeed(parent) as CrmDebitNoteDoc)
      : undefined;

  return (
    <EntityListShell
      title="New debit note"
      subtitle={
        initial
          ? 'Pre-filled from a vendor bill — confirm and save.'
          : 'Adjust a vendor bill downward for a return, discount, or short-shipment.'
      }
    >
      <DebitNoteForm initial={initial} />
    </EntityListShell>
  );
}
