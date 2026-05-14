/**
 * Edit payment receipt — `/dashboard/crm/sales/receipts/[receiptId]/edit`.
 *
 * Hydrates the existing receipt and passes it to the shared
 * `<ReceiptForm>` (re-used from the Create flow). Per the Rust DTO,
 * financial fields (amount, mode, clientId, currency, applyTo) are
 * NOT patchable — the form disables those inputs in Edit mode.
 */

import { notFound } from 'next/navigation';
import { FileCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${title}`}
                subtitle="Update non-financial fields. Amount and applied invoices are locked."
                icon={FileCheck}
            />
            <ReceiptForm initial={receipt} />
        </div>
    );
}
