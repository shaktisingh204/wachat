

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmQuotation } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getQuotations(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ quotations: WithId<CrmQuotation>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { quotations: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmQuotation> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [quotations, total] = await Promise.all([
            db.collection('crm_quotations')
                .find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_quotations').countDocuments(filter)
        ]);

        return {
            quotations: JSON.parse(JSON.stringify(quotations)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM quotations:", e);
        return { quotations: [], total: 0 };
    }
}

export async function saveQuotation(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const quotationData: Omit<CrmQuotation, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(formData.get('accountId') as string),
            quotationNumber: formData.get('quotationNumber') as string,
            quotationDate: new Date(formData.get('quotationDate') as string),
            validTillDate: formData.get('validTillDate') ? new Date(formData.get('validTillDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            subtotal: subtotal,
            total: subtotal, // For now, total is same as subtotal
            termsAndConditions: JSON.parse(formData.get('termsAndConditions') as string || '[]'),
            notes: formData.get('notes') as string,
            additionalInfo: JSON.parse(formData.get('additionalInfo') as string || '[]'),
            status: 'Draft',
        };

        if (!quotationData.quotationNumber || !quotationData.accountId) {
            return { error: 'Quotation number and client are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_quotations').insertOne({
            ...quotationData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/sales/quotations');
        return { message: 'Quotation saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
