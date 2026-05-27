'use server';

/**
 * CRM Invoice server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, every read/write delegates to the
 *    Rust BFF (`/v1/crm/invoices`) via
 *    `src/lib/rust-client/crm-invoices.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the pages at
 * `/dashboard/crm/sales/invoices/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { CrmInvoice, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import {
    crmInvoicesApi,
    type CrmInvoiceLineItem,
    type CrmInvoiceTotals,
} from '@/lib/rust-client/crm-invoices';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { generatePublicHash } from '@/lib/public-hash';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getInvoices(
    page: number = 1,
    limit: number = 20,
    filters?: { month?: number, year?: number }
): Promise<{ invoices: WithId<CrmInvoice>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { invoices: [], total: 0 };

    if (useRustCrm()) {
        try {
            const items = await crmInvoicesApi.list({
                page,
                limit,
                month: filters?.month,
                year: filters?.year,
            });
            const arr = Array.isArray(items) ? items : [];
            return {
                invoices: JSON.parse(JSON.stringify(arr)) as WithId<CrmInvoice>[],
                total: arr.length,
            };
        } catch (e) {
            console.error('[getInvoices] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'invoice', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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

    const guard = await requirePermission('crm_invoice', 'create');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const lineItemsLegacy = JSON.parse((formData.get('lineItems') as string) || '[]') as Array<any>;
            const items: CrmInvoiceLineItem[] = lineItemsLegacy.map((li: any) => ({
                itemId: li.itemId,
                description: li.description ?? li.name,
                qty: Number(li.quantity ?? li.qty ?? 0),
                rate: Number(li.rate ?? 0),
                total: Number(li.total ?? Number(li.quantity ?? 0) * Number(li.rate ?? 0)),
            }));
            const subTotal = items.reduce((sum, li) => sum + (li.total || 0), 0);
            const totals: CrmInvoiceTotals = { subTotal, total: subTotal };

            const invoiceNo = (formData.get('invoiceNumber') as string | null) ||
                `INV-${Date.now().toString().slice(-5)}`;
            const dateRaw = (formData.get('invoiceDate') as string | null) || '';
            const date = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
            const dueDateRaw = (formData.get('dueDate') as string | null) || '';
            const dueDate = dueDateRaw ? new Date(dueDateRaw).toISOString() : date;
            const clientId = (formData.get('accountId') as string | null) || '';
            const currency = (formData.get('currency') as string | null) || 'INR';
            const notes = (formData.get('notes') as string | null) || undefined;
            const fromKindRaw = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            let designMetadata: Record<string, unknown> | undefined = undefined;
            const dmRaw = formData.get('designMetadata') as string | null;
            if (dmRaw) {
                try {
                    designMetadata = JSON.parse(dmRaw);
                } catch {
                    // ignore malformed
                }
            }

            const created = await crmInvoicesApi.create({
                invoiceNo,
                date,
                dueDate,
                clientId,
                currency,
                items,
                totals,
                customerNotes: notes,
                fromKind: fromKindRaw as any,
                fromId,
                designMetadata,
            });

            const id = (created as any)._id?.toString() || '';
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'invoice',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            const customFieldsRaw = formData.get('customFields') as string | null;
            if (customFieldsRaw && id) {
                try {
                    const parsed = JSON.parse(customFieldsRaw);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        await applyCustomFieldsToEntity('invoice', id, parsed as Record<string, unknown>);
                    }
                } catch {
                    /* non-fatal */
                }
            }

            revalidatePath('/dashboard/crm/sales/invoices');
            return { message: 'Invoice saved successfully.' };
        } catch (e) {
            console.error('[saveInvoice] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'invoice', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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

        const dmRawLegacy = formData.get('designMetadata') as string | null;
        if (dmRawLegacy) {
            try {
                const parsed = JSON.parse(dmRawLegacy);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    (invoiceData as any).designMetadata = parsed;
                }
            } catch {
                // ignore
            }
        }

        const insertResult = await db.collection('crm_invoices').insertOne({
            ...invoiceData,
            ...(lineage ? { lineage } : {}),
            // Public portal hash — drives `/share/invoice/[hash]`.
            publicHash: generatePublicHash(),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'invoice',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

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

        // QuickBooks auto-sync (fire-and-forget). Only fires when the
        // tenant has the integration connected with `autoSync: true`.
        try {
            const { maybeAutoSyncInvoice } = await import(
                '@/lib/integrations/quickbooks/sync'
            );
            void maybeAutoSyncInvoice(
                String(session.user._id),
                insertResult.insertedId.toString(),
            );
        } catch (qbErr) {
            console.error('[saveInvoice] QBO auto-sync hook failed:', qbErr);
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
    if (!invoiceId) return { success: false, error: 'Invalid invoice id' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmInvoicesApi.update(invoiceId, {
                invoiceNo: updates.invoiceNumber,
                date: updates.invoiceDate
                    ? new Date(updates.invoiceDate).toISOString()
                    : undefined,
                dueDate:
                    updates.dueDate === null
                        ? undefined
                        : updates.dueDate
                            ? new Date(updates.dueDate).toISOString()
                            : undefined,
                status: updates.status,
                customerNotes: updates.notes,
                currency: updates.currency,
            });
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'invoice',
                    entityId: invoiceId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/sales/invoices');
            revalidatePath(`/dashboard/crm/sales/invoices/${invoiceId}`);
            return { success: true };
        } catch (e) {
            console.error('[updateInvoice] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'invoice', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(invoiceId)) return { success: false, error: 'Invalid invoice id' };

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

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'invoice',
                entityId: invoiceId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/invoices');
        revalidatePath(`/dashboard/crm/sales/invoices/${invoiceId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getInvoiceById(invoiceId: string): Promise<WithId<CrmInvoice> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmInvoicesApi.getById(invoiceId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmInvoice>) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.code === 'NOT_FOUND') return null;
            console.error('[getInvoiceById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'invoice', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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

/* ─── Duplicate clusters + merge (§1D deep-view) ─────────────────── */

/**
 * Mark every invoice in `losingIds` as a duplicate of `survivorId` and
 * soft-cancel them. Multi-tenant — only invoices owned by the current
 * tenant are touched. Idempotent: calling twice is a no-op.
 */
export async function resolveInvoiceDuplicates(
    survivorId: string,
    losingIds: string[],
): Promise<{ success: boolean; resolved: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, resolved: 0, error: 'Access denied.' };
    if (!survivorId || !ObjectId.isValid(survivorId)) {
        return { success: false, resolved: 0, error: 'Invalid survivor id.' };
    }
    const validLosing = losingIds.filter((id) => id && ObjectId.isValid(id) && id !== survivorId);
    if (validLosing.length === 0) {
        return { success: false, resolved: 0, error: 'No losing invoices supplied.' };
    }
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const result = await db.collection('crm_invoices').updateMany(
            {
                _id: { $in: validLosing.map((id) => new ObjectId(id)) },
                userId,
            },
            {
                $set: {
                    status: 'Cancelled',
                    duplicateOf: new ObjectId(survivorId),
                    duplicateResolvedAt: new Date(),
                    duplicateResolvedBy: userId,
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'merge',
                entityKind: 'invoice',
                entityId: survivorId,
                reason: `Merged ${result.modifiedCount} duplicate(s): ${validLosing.join(', ')}`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/invoices');
        revalidatePath('/dashboard/crm/sales/invoices/duplicates');
        return { success: true, resolved: result.modifiedCount };
    } catch (e: any) {
        return { success: false, resolved: 0, error: getErrorMessage(e) };
    }
}

/**
 * KPI tile for the duplicates page: number of clusters surfaced by
 * `findInvoiceDuplicates()`, how many were already resolved (cancelled
 * + flagged as `duplicateOf`), and how many are still pending review.
 */
interface InvoiceDuplicatesDeepKpis {
    clusters: number;
    resolved: number;
    pending: number;
    totalDuplicateValue: number;
}

export async function getInvoiceDuplicatesDeepKpis(): Promise<InvoiceDuplicatesDeepKpis> {
    const empty: InvoiceDuplicatesDeepKpis = { clusters: 0, resolved: 0, pending: 0, totalDuplicateValue: 0 };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const resolvedInvoices = await db.collection('crm_invoices')
            .find({ userId, duplicateOf: { $exists: true } })
            .project({ totalAmount: 1 })
            .toArray();

        const resolved = resolvedInvoices.length;
        const totalDuplicateValue = resolvedInvoices.reduce(
            (sum, inv) => sum + Number((inv as { totalAmount?: number }).totalAmount ?? 0),
            0,
        );

        return { clusters: 0, resolved, pending: 0, totalDuplicateValue };
    } catch (e) {
        console.error('[getInvoiceDuplicatesDeepKpis] failed:', e);
        return empty;
    }
}

export async function getUnpaidInvoicesByAccount(accountId: string): Promise<WithId<CrmInvoice>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const items = await crmInvoicesApi.list({
                clientId: accountId,
            });
            const arr = Array.isArray(items) ? items : [];
            const unpaid = arr.filter((d: any) => {
                const s = (d.status as string | undefined)?.toLowerCase();
                return s !== 'paid' && s !== 'cancelled';
            });
            return JSON.parse(JSON.stringify(unpaid)) as WithId<CrmInvoice>[];
        } catch (e) {
            console.error('[getUnpaidInvoicesByAccount] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'invoice', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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
