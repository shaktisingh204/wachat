'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmProformaInvoice, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';

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

        const filter: any = { userId: userObjectId };

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

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a proforma invoice
        // is created in the context of a parent doc (Lead, Deal,
        // Quotation, or Sales Order). Both fields are optional, so
        // existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['lead', 'deal', 'quotation', 'salesOrder'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                lead: 'crm_leads',
                deal: 'crm_deals',
                quotation: 'crm_quotations',
                salesOrder: 'crm_sales_orders',
            };
            const parentNoField: Record<string, string> = {
                lead: 'title',
                deal: 'name',
                quotation: 'quotationNumber',
                salesOrder: 'orderNumber',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(fromId),
                    userId: userObjectId,
                });
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: fromKind as LineageKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[fromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — proforma still saves
            }
        }

        const insertResult = await db.collection<CrmProformaInvoice>('crm_proforma_invoices').insertOne({
            ...proformaData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    lead: 'crm_leads',
                    deal: 'crm_deals',
                    quotation: 'crm_quotations',
                    salesOrder: 'crm_sales_orders',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'proforma',
                    id: insertResult.insertedId.toString(),
                    no: proformaData.proformaNumber,
                    status: proformaData.status,
                    createdAt: new Date().toISOString(),
                });
                await db.collection(coll).updateOne(
                    { _id: new ObjectId(fromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        revalidatePath('/dashboard/crm/sales/proforma');
        return { message: 'Proforma Invoice saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
