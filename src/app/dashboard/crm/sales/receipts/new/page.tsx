/**
 * Create payment receipt — `/dashboard/crm/sales/receipts/new`.
 *
 * Server component shell. The shared `<ReceiptForm>` (also used by Edit)
 * handles all interactive bits — including multi-invoice apply rows and
 * the `?invoiceId=` smart-default pre-fill.
 *
 * Convert flow: when invoked with `?fromKind=invoice&fromId=…`, we hydrate
 * the parent invoice via `getCrmEntityForPrefill` and seed the form with
 * `clientId`, `currency`, and a single apply-row referencing the invoice
 * (so the form's unpaid-invoice lookup auto-fills the outstanding amount).
 *
 * Per the WsCustomFieldBelongsTo set, `'paymentReceipt'` is NOT a
 * custom-field anchor, so this surface deliberately skips custom-fields
 * plumbing.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ReceiptForm } from '../_components/receipt-form';
import { getCrmEntityForPrefill } from '@/lib/crm/convert-with-prefill';
import type { CrmInvoiceDoc } from '@/lib/rust-client/crm-invoices';
import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';

export const dynamic = 'force-dynamic';

interface NewReceiptSearch {
    fromKind?: string;
    fromId?: string;
}

/** Project a parent invoice into the receipt-form `initial` shape. */
function invoiceToReceiptSeed(
    invoice: CrmInvoiceDoc,
): Partial<CrmPaymentReceiptDoc> {
    const outstanding = Math.max(
        0,
        Number(invoice.totals?.total ?? 0) - Number(invoice.amountPaid ?? 0),
    );
    return {
        clientId: invoice.clientId,
        currency: invoice.currency ?? 'INR',
        applyTo: [
            { invoiceId: String(invoice._id), amount: outstanding },
        ],
    };
}

export default async function NewPaymentReceiptPage({
    searchParams,
}: {
    searchParams: Promise<NewReceiptSearch>;
}) {
    const sp = await searchParams;
    const parent = await getCrmEntityForPrefill<CrmInvoiceDoc>(
        sp.fromKind,
        sp.fromId,
    );

    const initial =
        parent && (sp.fromKind ?? '').trim() === 'invoice'
            ? (invoiceToReceiptSeed(parent) as CrmPaymentReceiptDoc)
            : undefined;

    return (
        <EntityDetailShell
            eyebrow="RECEIPT"
            title="New payment receipt"
            back={{ href: '/dashboard/crm/sales/receipts', label: 'Receipts' }}
        >
            <ReceiptForm initial={initial} />
        </EntityDetailShell>
    );
}
