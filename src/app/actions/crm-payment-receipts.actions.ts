

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmPaymentReceipt } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getPaymentReceipts(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ receipts: WithId<CrmPaymentReceipt>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { receipts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmPaymentReceipt> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [receipts, total] = await Promise.all([
            db.collection('crm_payment_receipts')
                .find(filter)
                .sort({ receiptDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_payment_receipts').countDocuments(filter)
        ]);

        return {
            receipts: JSON.parse(JSON.stringify(receipts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM payment receipts:", e);
        return { receipts: [], total: 0 };
    }
}

export async function savePaymentReceipt(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const paymentRecords = JSON.parse(formData.get('paymentRecords') as string || '[]');
        const settledInvoices = JSON.parse(formData.get('settledInvoices') as string || '[]');
        const totalAmountReceived = paymentRecords.reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0);

        const receiptData: Omit<CrmPaymentReceipt, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(formData.get('accountId') as string),
            receiptNumber: formData.get('receiptNumber') as string,
            receiptDate: new Date(formData.get('receiptDate') as string),
            currency: formData.get('currency') as string,
            totalAmountReceived,
            paymentRecords,
            settledInvoices,
            notes: formData.get('notes') as string,
        };

        if (!receiptData.receiptNumber || !receiptData.accountId || totalAmountReceived <= 0) {
            return { error: 'Receipt number, client, and a valid payment amount are required.' };
        }

        const { db } = await connectToDatabase();
        
        // Use a transaction to ensure atomicity
        const dbSession = db.client.startSession();
        try {
            await dbSession.withTransaction(async () => {
                // 1. Save the payment receipt
                await db.collection('crm_payment_receipts').insertOne({
                    ...receiptData,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any, { session: dbSession });
                
                // 2. Update the status of settled invoices (this part is simplified for now)
                // A real implementation would check if the invoice is fully paid.
                for (const settlement of settledInvoices) {
                    if (settlement.invoiceId) {
                         await db.collection('crm_invoices').updateOne(
                            { _id: new ObjectId(settlement.invoiceId) },
                            { $set: { status: 'Partially Paid' } }, // Or 'Paid' if fully settled
                            { session: dbSession }
                        );
                    }
                }
            });
        } finally {
            await dbSession.endSession();
        }

        revalidatePath('/dashboard/crm/sales/receipts');
        revalidatePath('/dashboard/crm/sales/invoices');
        return { message: 'Payment receipt saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
