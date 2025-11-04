

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmInvoice } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getInvoices(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ invoices: WithId<CrmInvoice>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { invoices: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmInvoice> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [invoices, total] = await Promise.all([
            db.collection('crm_invoices')
                .find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_invoices').countDocuments(filter)
        ]);

        return {
            invoices: JSON.parse(JSON.stringify(invoices)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM invoices:", e);
        return { invoices: [], total: 0 };
    }
}

export async function saveInvoice(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const invoiceData: Omit<CrmInvoice, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(formData.get('accountId') as string),
            invoiceNumber: formData.get('invoiceNumber') as string,
            invoiceDate: new Date(formData.get('invoiceDate') as string),
            dueDate: formData.get('dueDate') ? new Date(formData.get('dueDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            subtotal: subtotal,
            total: subtotal, // For now, total is same as subtotal
            termsAndConditions: JSON.parse(formData.get('termsAndConditions') as string || '[]'),
            notes: formData.get('notes') as string,
            additionalInfo: JSON.parse(formData.get('additionalInfo') as string || '[]'),
            status: 'Draft',
        };

        if (!invoiceData.invoiceNumber || !invoiceData.accountId) {
            return { error: 'Invoice number and client are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_invoices').insertOne({
            ...invoiceData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/sales/invoices');
        return { message: 'Invoice saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getUnpaidInvoicesByAccount(accountId: string): Promise<WithId<CrmInvoice>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (!ObjectId.isValid(accountId)) return [];
    
    try {
        const { db } = await connectToDatabase();
        const invoices = await db.collection('crm_invoices').find({
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(accountId),
            status: { $in: ['Sent', 'Overdue', 'Partially Paid', 'Draft'] }
        }).toArray();
        
        return JSON.parse(JSON.stringify(invoices));
    } catch (e) {
        return [];
    }
}
