'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmProformaInvoice } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

async function getNextProformaNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastDoc = await db.collection<CrmProformaInvoice>('crm_proforma_invoices')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastDoc.length === 0) {
        return 'PI-00001';
    }

    const lastNumber = lastDoc[0].proformaNumber;
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    return `PI-${Date.now().toString().slice(-5)}`;
}

export async function getProformaInvoices(
    page: number = 1,
    limit: number = 20,
    filters?: { month?: number, year?: number, query?: string }
): Promise<{ invoices: WithId<CrmProformaInvoice>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { invoices: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: Filter<CrmProformaInvoice> = { userId: userObjectId };

        if (filters?.month && filters?.year) {
            const start = new Date(filters.year, filters.month - 1, 1);
            const end = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
            filter.proformaDate = { $gte: start, $lte: end };
        }

        if (filters?.query) {
            filter.$or = [
                { proformaNumber: { $regex: filters.query, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [invoices, total] = await Promise.all([
            db.collection<CrmProformaInvoice>('crm_proforma_invoices')
                .find(filter)
                .sort({ proformaDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection<CrmProformaInvoice>('crm_proforma_invoices').countDocuments(filter)
        ]);

        return {
            invoices: JSON.parse(JSON.stringify(invoices)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM proforma invoices:", e);
        return { invoices: [], total: 0 };
    }
}

export async function saveProformaInvoice(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let proformaNumber = formData.get('proformaNumber') as string;

        if (!proformaNumber) {
            proformaNumber = await getNextProformaNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const proformaData: Omit<CrmProformaInvoice, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            accountId: new ObjectId(formData.get('accountId') as string),
            proformaNumber: proformaNumber,
            proformaDate: new Date(formData.get('proformaDate') as string),
            validTillDate: formData.get('validTillDate') ? new Date(formData.get('validTillDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            subtotal: subtotal,
            total: subtotal,
            termsAndConditions: JSON.parse(formData.get('termsAndConditions') as string || '[]'),
            notes: formData.get('notes') as string,
            status: 'Draft',
        };

        if (!proformaData.accountId || lineItems.length === 0) {
            return { error: 'Client and at least one line item are required.' };
        }

        const existing = await db.collection<CrmProformaInvoice>('crm_proforma_invoices').findOne({ userId: userObjectId, proformaNumber: proformaData.proformaNumber });
        if (existing) {
            proformaData.proformaNumber = await getNextProformaNumber(db, userObjectId);
        }

        await db.collection<CrmProformaInvoice>('crm_proforma_invoices').insertOne({
            ...proformaData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/sales/proforma');
        return { message: 'Proforma Invoice saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
