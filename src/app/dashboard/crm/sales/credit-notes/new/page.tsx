/**
 * Create credit note — `/dashboard/crm/sales/credit-notes/new`.
 *
 * Server component shell. The shared `<CreditNoteForm>` (also used by
 * Edit) handles all interactive bits.
 *
 * Convert flow: when invoked with `?fromKind=invoice&fromId=…`, we hydrate
 * the parent invoice via `getCrmEntityForPrefill` and seed the form with
 * `clientId`, `currency`, `linkedInvoiceId`, and the invoice's line items
 * (mapped 1:1 — the user can edit qty/rate on return). No custom fields
 * — `'creditNote'` is not in `WsCustomFieldBelongsTo`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { CreditNoteForm } from '../_components/credit-note-form';
import { getCrmEntityForPrefill } from '@/lib/crm/convert-with-prefill';
import type { CrmInvoiceDoc } from '@/lib/rust-client/crm-invoices';
import type {
    CrmCreditNoteDoc,
    CreditNoteLineItem,
} from '@/lib/rust-client/crm-credit-notes';

export const dynamic = 'force-dynamic';

interface NewCreditNoteSearch {
    fromKind?: string;
    fromId?: string;
}

/** Project a parent invoice into the credit-note-form `initial` shape. */
function invoiceToCreditNoteSeed(
    invoice: CrmInvoiceDoc,
): Partial<CrmCreditNoteDoc> {
    const items: CreditNoteLineItem[] = (invoice.items ?? []).map((li) => ({
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
        clientId: invoice.clientId,
        currency: invoice.currency ?? 'INR',
        linkedInvoiceId: String(invoice._id),
        items,
    };
}

export default async function NewCreditNotePage({
    searchParams,
}: {
    searchParams: Promise<NewCreditNoteSearch>;
}) {
    const sp = await searchParams;
    const parent = await getCrmEntityForPrefill<CrmInvoiceDoc>(
        sp.fromKind,
        sp.fromId,
    );

    const initial =
        parent && (sp.fromKind ?? '').trim() === 'invoice'
            ? (invoiceToCreditNoteSeed(parent) as CrmCreditNoteDoc)
            : undefined;

    return (
        <EntityDetailShell
            eyebrow="CREDIT NOTE"
            title="New credit note"
            back={{ href: '/dashboard/crm/sales/credit-notes', label: 'Credit Notes' }}
        >
            <CreditNoteForm initial={initial} />
        </EntityDetailShell>
    );
}
