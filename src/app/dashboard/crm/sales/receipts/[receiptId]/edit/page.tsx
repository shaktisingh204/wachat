import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { EditReceiptForm } from './edit-receipt-form';
import { getPaymentReceiptById } from '@/app/actions/crm-payment-receipts.actions';
import { LineageRail } from '@/components/crm/lineage-rail';

export default async function EditPaymentReceiptPage(
    props: { params: Promise<{ receiptId: string }> }
) {
    const { receiptId } = await props.params;
    const r = await getPaymentReceiptById(receiptId);

    if (!r) {
        notFound();
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <Link href="/dashboard/crm/sales/receipts" className="inline-flex">
                    <ZoruButton variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Receipts
                    </ZoruButton>
                </Link>
                <h1 className="mt-2 text-[26px] leading-tight text-zoru-ink">
                    Edit Receipt {r.receiptNumber}
                </h1>
                <p className="mt-1 text-[13px] text-zoru-ink-muted">
                    Update bank account, date, and notes. Payment amounts and invoice settlements are locked.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <EditReceiptForm receipt={r} />
                <LineageRail
                    current={{
                        kind: 'paymentReceipt',
                        id: r._id.toString(),
                        no: r.receiptNumber,
                        status: (r as any).status,
                    }}
                    lineage={r.lineage ?? []}
                />
            </div>
        </div>
    );
}
