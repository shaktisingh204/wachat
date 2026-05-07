
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmInvoice, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';

export async function getInvoices(
    page: number = 1,
    limit: number = 20,
    filters?: { month?: number, year?: number }
): Promise<{ invoices: WithId<CrmInvoice>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { invoices: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        if (filters?.month && filters?.year) {
            const start = new Date(filters.year, filters.month - 1, 1);
            const end = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
            filter.invoiceDate = { $gte: start, $lte: end };
        }

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

        const attachmentsRaw = formData.get('attachmentUrls') as string | null;
        let attachments: string[] | undefined;
        if (attachmentsRaw) {
            try {
                const parsed = JSON.parse(attachmentsRaw);
                if (Array.isArray(parsed)) {
                    attachments = parsed.filter((u): u is string => typeof u === 'string' && !!u);
                }
            } catch {
                // ignore malformed JSON
            }
        }

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
            attachments: attachments && attachments.length ? attachments : undefined,
            status: 'Draft',
        };

        if (!invoiceData.invoiceNumber || !invoiceData.accountId) {
            return { error: 'Invoice number and client are required.' };
        }

        const { db } = await connectToDatabase();

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when an invoice is
        // created in the context of a parent doc (typically a
        // Quotation or Sales Order). Both fields are optional, so
        // existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['quotation', 'salesOrder', 'proforma', 'deal', 'lead'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                quotation: 'crm_quotations',
                salesOrder: 'crm_sales_orders',
                proforma: 'crm_proforma_invoices',
                deal: 'crm_deals',
                lead: 'crm_leads',
            };
            const parentNoField: Record<string, string> = {
                quotation: 'quotationNumber',
                salesOrder: 'orderNumber',
                proforma: 'proformaNumber',
                deal: 'name',
                lead: 'title',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(fromId),
                    userId: new ObjectId(session.user._id),
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
                // ignore lineage seed failures — invoice still saves
            }
        }

        const insertResult = await db.collection('crm_invoices').insertOne({
            ...invoiceData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Custom fields (Worksuite §13). The dialog wires a JSON-encoded
        // map under `customFields`; persist via the shared upsert helper.
        const customFieldsRaw = formData.get('customFields') as string | null;
        if (customFieldsRaw) {
            let parsedValues: Record<string, unknown> = {};
            try {
                const parsed = JSON.parse(customFieldsRaw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedValues = parsed as Record<string, unknown>;
                }
            } catch {
                parsedValues = {};
            }
            if (Object.keys(parsedValues).length > 0) {
                try {
                    await applyCustomFieldsToEntity('invoice', insertResult.insertedId.toString(), parsedValues);
                } catch {
                    // non-fatal — invoice already saved
                }
            }
        }

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    quotation: 'crm_quotations',
                    salesOrder: 'crm_sales_orders',
                    proforma: 'crm_proforma_invoices',
                    deal: 'crm_deals',
                    lead: 'crm_leads',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'invoice',
                    id: insertResult.insertedId.toString(),
                    no: invoiceData.invoiceNumber,
                    status: invoiceData.status,
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

        revalidatePath('/dashboard/crm/sales/invoices');
        return { message: 'Invoice saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateInvoice(
    invoiceId: string,
    updates: {
        invoiceNumber?: string;
        invoiceDate?: string;
        dueDate?: string | null;
        status?: string;
        notes?: string;
        currency?: string;
    },
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(invoiceId)) return { success: false, error: 'Invalid invoice id' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        const set: Record<string, any> = { updatedAt: new Date() };
        if (updates.invoiceNumber !== undefined) set.invoiceNumber = updates.invoiceNumber;
        if (updates.invoiceDate !== undefined) set.invoiceDate = new Date(updates.invoiceDate);
        if (updates.dueDate !== undefined) {
            set.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
        }
        if (updates.status !== undefined) set.status = updates.status;
        if (updates.notes !== undefined) set.notes = updates.notes;
        if (updates.currency !== undefined) set.currency = updates.currency;

        const { db } = await connectToDatabase();
        const result = await db.collection('crm_invoices').updateOne(
            {
                _id: new ObjectId(invoiceId),
                userId: new ObjectId(session.user._id),
            },
            { $set: set },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Invoice not found' };
        }

        revalidatePath('/dashboard/crm/sales/invoices');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getInvoiceById(invoiceId: string): Promise<WithId<CrmInvoice> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(invoiceId)) return null;

    try {
        const { db } = await connectToDatabase();
        const invoice = await db.collection('crm_invoices').findOne({
            _id: new ObjectId(invoiceId),
            userId: new ObjectId(session.user._id),
        });
        if (!invoice) return null;
        return JSON.parse(JSON.stringify(invoice));
    } catch (e) {
        console.error('Failed to fetch invoice by id:', e);
        return null;
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
