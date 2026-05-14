/**
 * Create payment receipt — `/dashboard/crm/sales/receipts/new`.
 *
 * Server component shell. The shared `<ReceiptForm>` (also used by Edit)
 * handles all interactive bits — including multi-invoice apply rows and
 * the `?invoiceId=` smart-default pre-fill.
 *
 * Per the WsCustomFieldBelongsTo set, `'paymentReceipt'` is NOT a
 * custom-field anchor, so this surface deliberately skips custom-fields
 * plumbing.
 */

import { FileCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { ReceiptForm } from '../_components/receipt-form';

export const dynamic = 'force-dynamic';

export default async function NewPaymentReceiptPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New payment receipt"
                subtitle="Record a payment received from a customer and apply it to open invoices."
                icon={FileCheck}
            />
            <ReceiptForm />
        </div>
    );
}
