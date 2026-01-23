

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmQuotation } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

async function getNextQuotationNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastQuotation = await db.collection<CrmQuotation>('crm_quotations')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastQuotation.length === 0) {
        return 'QUO-00001';
    }

    const lastNumber = lastQuotation[0].quotationNumber;
    // Regex to find a prefix and a number at the end of the string
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        // Pad the new number to the same length as the old one
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    // Fallback for unexpected formats or if no number is found
    return `QUO-${Date.now().toString().slice(-5)}`;
}


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
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        let quotationNumber = formData.get('quotationNumber') as string;

        // If the quotation number is empty, generate a new one.
        if (!quotationNumber) {
            quotationNumber = await getNextQuotationNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const quotationData: Omit<CrmQuotation, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            accountId: new ObjectId(formData.get('accountId') as string),
            quotationNumber: quotationNumber,
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

        if (!quotationData.accountId || lineItems.length === 0) {
            return { error: 'Client and at least one line item are required.' };
        }
        
        // Final check for duplicates before inserting
        const existing = await db.collection('crm_quotations').findOne({ userId: userObjectId, quotationNumber: quotationData.quotationNumber });
        if (existing) {
            quotationData.quotationNumber = await getNextQuotationNumber(db, userObjectId);
        }

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
