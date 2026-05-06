import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { EditReceiptForm } from './edit-receipt-form';
import { getPaymentReceiptById } from '@/app/actions/crm-payment-receipts.actions';

export default async function EditPaymentReceiptPage(
    props: { params: Promise<{ receiptId: string }> }
) {
    const { receiptId } = await props.params;
    const receipt = await getPaymentReceiptById(receiptId);

    if (!receipt) {
        notFound();
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <Link href="/dashboard/crm/sales/receipts" className="inline-flex">
                    <ZoruButton variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Receipts
                    </ZoruButton>
                </Link>
                <h1 className="mt-2 text-[26px] leading-tight text-zoru-ink">
                    Edit Receipt {receipt.receiptNumber}
                </h1>
                <p className="mt-1 text-[13px] text-zoru-ink-muted">
                    Update bank account, date, and notes. Payment amounts and invoice settlements are locked.
                </p>
            </div>

            <EditReceiptForm receipt={receipt} />
        </div>
    );
}
