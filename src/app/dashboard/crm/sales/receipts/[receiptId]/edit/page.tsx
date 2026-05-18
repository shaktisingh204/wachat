/**
 * Edit payment receipt — `/dashboard/crm/sales/receipts/[receiptId]/edit`.
 *
 * Hydrates the existing receipt and passes it to the shared
 * `<ReceiptForm>` (re-used from the Create flow). Per the Rust DTO,
 * financial fields (amount, mode, clientId, currency, applyTo) are
 * NOT patchable — the form disables those inputs in Edit mode.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ReceiptForm } from '../../_components/receipt-form';
import { getPaymentReceipt } from '@/app/actions/crm/payment-receipts.actions';

export const dynamic = 'force-dynamic';

export default async function EditPaymentReceiptPage({
    params,
}: {
    params: Promise<{ receiptId: string }>;
}) {
    const { receiptId } = await params;
    const { receipt } = await getPaymentReceipt(receiptId);

    if (!receipt) notFound();

    const title = receipt.receiptNo || `Receipt ${receiptId.slice(-6)}`;

    return (
        <EntityDetailShell
            eyebrow="RECEIPT"
            title={`Edit ${title}`}
            back={{ href: `/dashboard/crm/sales/receipts/${receiptId}`, label: 'Receipt' }}
        >
            <ReceiptForm initial={receipt} />
        </EntityDetailShell>
    );
}
