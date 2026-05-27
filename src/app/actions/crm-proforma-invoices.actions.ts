'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, type Filter, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import type { CrmProformaInvoice, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmProformaInvoicesApi } from '@/lib/rust-client/crm-proforma-invoices';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

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
    filters?: { month?: number, year?: number, query?: string, status?: string, archived?: 'active' | 'archived' | 'all', accountId?: string }
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

        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }

        if (filters?.archived === 'archived') {
            filter.archived = true;
        } else if (filters?.archived !== 'all') {
            filter.archived = { $ne: true };
        }

        if (filters?.accountId && ObjectId.isValid(filters.accountId)) {
            filter.accountId = new ObjectId(filters.accountId);
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

export async function getProformaInvoiceById(
    proformaId: string,
): Promise<WithId<CrmProformaInvoice> | null> {
    if (!proformaId || !ObjectId.isValid(proformaId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmProformaInvoicesApi.getById(proformaId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getProformaInvoiceById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'proforma_invoice',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection<CrmProformaInvoice>('crm_proforma_invoices').findOne({
            _id: new ObjectId(proformaId),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('getProformaInvoiceById error:', e);
        return null;
    }
}

export async function updateProformaInvoice(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_proforma_invoice', 'edit');
    if (!guard.ok) return { error: guard.error };

    const proformaId = (formData.get('proformaId') as string | null) || '';
    if (!proformaId || !ObjectId.isValid(proformaId)) {
        return { error: 'Invalid proforma id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const $set: Record<string, any> = { updatedAt: new Date() };
        const proformaNumber = formData.get('proformaNumber') as string | null;
        if (proformaNumber) $set.proformaNumber = proformaNumber;
        const proformaDateRaw = formData.get('proformaDate') as string | null;
        if (proformaDateRaw) $set.proformaDate = new Date(proformaDateRaw);
        const validTillDateRaw = formData.get('validTillDate') as string | null;
        if (validTillDateRaw) $set.validTillDate = new Date(validTillDateRaw);
        const currency = formData.get('currency') as string | null;
        if (currency) $set.currency = currency;
        const notes = formData.get('notes') as string | null;
        if (notes !== null) $set.notes = notes;
        const status = formData.get('status') as string | null;
        if (status) $set.status = status;

        const lineItemsRaw = formData.get('lineItems') as string | null;
        if (lineItemsRaw) {
            try {
                const lineItems = JSON.parse(lineItemsRaw);
                if (Array.isArray(lineItems)) {
                    $set.lineItems = lineItems;
                    const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
                    $set.subtotal = subtotal;

                    const discountOverall = Number(formData.get('discountOverall')) || 0;
                    const shippingCharge = Number(formData.get('shippingCharge')) || 0;
                    const adjustment = Number(formData.get('adjustment')) || 0;
                    const roundOff = Number(formData.get('roundOff')) || 0;
                    const taxTotal = lineItems.reduce((sum: number, item: any) => {
                        const taxPct = Number(item.taxRatePct || item.taxPct) || 0;
                        const discountPct = Number(item.discountPct) || 0;
                        const base = item.quantity * item.rate;
                        const taxable = base * (1 - discountPct / 100);
                        return sum + taxable * (taxPct / 100);
                    }, 0);

                    $set.discountOverall = discountOverall;
                    $set.shippingCharge = shippingCharge;
                    $set.adjustment = adjustment;
                    $set.roundOff = roundOff;
                    $set.taxTotal = taxTotal;
                    $set.total = subtotal + taxTotal - discountOverall + shippingCharge + adjustment + roundOff;
                }
            } catch {
                /* ignore malformed JSON */
            }
        }

        const accountId = formData.get('accountId') as string | null;
        if (accountId && ObjectId.isValid(accountId)) {
            $set.accountId = new ObjectId(accountId);
        }

        const placeOfSupply = formData.get('placeOfSupply') as string | null;
        if (placeOfSupply) {
            $set.placeOfSupply = placeOfSupply;
        }

        const termsRaw = formData.get('termsAndConditions') as string | null;
        if (termsRaw) {
            try {
                const terms = JSON.parse(termsRaw);
                if (Array.isArray(terms)) $set.termsAndConditions = terms;
            } catch {
                /* ignore */
            }
        }

        const dmRaw = formData.get('designMetadata') as string | null;
        if (dmRaw) {
            try {
                const parsed = JSON.parse(dmRaw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    $set.designMetadata = parsed;
                }
            } catch {
                // ignore
            }
        }

        const result = await db.collection('crm_proforma_invoices').updateOne(
            { _id: new ObjectId(proformaId), userId: userObjectId },
            { $set },
        );

        if (result.matchedCount === 0) {
            return { error: 'Proforma invoice not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'proforma',
                entityId: proformaId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/proforma');
        revalidatePath(`/dashboard/crm/sales/proforma/${proformaId}`);
        return { message: 'Proforma invoice updated successfully.', id: proformaId };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveProformaInvoice(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_proforma_invoice', 'create');
    if (!guard.ok) return { error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let proformaNumber = formData.get('proformaNumber') as string;

        if (!proformaNumber) {
            proformaNumber = await getNextProformaNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const discountOverall = Number(formData.get('discountOverall')) || 0;
        const shippingCharge = Number(formData.get('shippingCharge')) || 0;
        const adjustment = Number(formData.get('adjustment')) || 0;
        const roundOff = Number(formData.get('roundOff')) || 0;
        const taxTotal = lineItems.reduce((sum: number, item: any) => {
            const taxPct = Number(item.taxRatePct || item.taxPct) || 0;
            const discountPct = Number(item.discountPct) || 0;
            const base = item.quantity * item.rate;
            const taxable = base * (1 - discountPct / 100);
            return sum + taxable * (taxPct / 100);
        }, 0);

        const proformaData: Omit<CrmProformaInvoice, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            accountId: new ObjectId(formData.get('accountId') as string),
            proformaNumber: proformaNumber,
            proformaDate: new Date(formData.get('proformaDate') as string),
            validTillDate: formData.get('validTillDate') ? new Date(formData.get('validTillDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            subtotal: subtotal,
            taxTotal: taxTotal,
            discountTotal: discountOverall,
            total: subtotal + taxTotal - discountOverall + shippingCharge + adjustment + roundOff,
            termsAndConditions: JSON.parse(formData.get('termsAndConditions') as string || '[]'),
            notes: formData.get('notes') as string,
            status: 'Draft',
            placeOfSupply: formData.get('placeOfSupply') as string || 'Maharashtra',
            discountOverall,
            shippingCharge,
            adjustment,
            roundOff,
            tdsPct: Number(formData.get('tdsPct')) || 0,
            tcsPct: Number(formData.get('tcsPct')) || 0,
        } as any;

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

        const dmRawLegacy = formData.get('designMetadata') as string | null;
        if (dmRawLegacy) {
            try {
                const parsed = JSON.parse(dmRawLegacy);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    (proformaData as any).designMetadata = parsed;
                }
            } catch {
                // ignore
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

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'proforma',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/proforma');
        return { message: 'Proforma Invoice saved successfully.', id: insertResult.insertedId.toString() };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── Status / archive / delete / convert ──────────────────────── */

interface ProformaKpis {
    total: number;
    issued: number;
    converted: number;
    expired: number;
    pending: number;
}

export async function getProformaInvoiceKpis(): Promise<ProformaKpis> {
    const zero: ProformaKpis = { total: 0, issued: 0, converted: 0, expired: 0, pending: 0 };

    const session = await getSession();
    if (!session?.user) return zero;
    const guard = await requirePermission('crm_proforma_invoice', 'view');
    if (!guard.ok) return zero;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const base: Filter<Document> = { userId: userObjectId, archived: { $ne: true } };
        const now = new Date();

        const [total, issued, converted, expired, pending] = await Promise.all([
            db.collection('crm_proforma_invoices').countDocuments(base),
            db.collection('crm_proforma_invoices').countDocuments({ ...base, status: 'Issued' }),
            db.collection('crm_proforma_invoices').countDocuments({ ...base, status: 'Converted' }),
            db.collection('crm_proforma_invoices').countDocuments({ ...base, validTillDate: { $lt: now }, status: { $nin: ['Converted', 'Cancelled'] } }),
            db.collection('crm_proforma_invoices').countDocuments({ ...base, status: { $in: ['Draft', 'Issued'] } }),
        ]);
        return { total, issued, converted, expired, pending };
    } catch (e) {
        console.error('getProformaInvoiceKpis error:', e);
        return zero;
    }
}

export async function setProformaStatus(
    proformaId: string,
    status: 'Draft' | 'Issued' | 'Converted' | 'Expired' | 'Cancelled',
): Promise<{ success: boolean; error?: string }> {
    if (!proformaId || !ObjectId.isValid(proformaId)) return { success: false, error: 'Invalid id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const guard = await requirePermission('crm_proforma_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_proforma_invoices').updateOne(
            { _id: new ObjectId(proformaId), userId: new ObjectId(session.user._id) },
            { $set: { status, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Proforma not found.' };
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'proforma',
                entityId: proformaId,
                diff: { status: { after: status } },
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/sales/proforma');
        revalidatePath(`/dashboard/crm/sales/proforma/${proformaId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function archiveProformaInvoice(proformaId: string): Promise<{ success: boolean; error?: string }> {
    if (!proformaId || !ObjectId.isValid(proformaId)) return { success: false, error: 'Invalid id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const guard = await requirePermission('crm_proforma_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_proforma_invoices').updateOne(
            { _id: new ObjectId(proformaId), userId: new ObjectId(session.user._id) },
            { $set: { archived: true, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Proforma not found.' };
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'archive',
                entityKind: 'proforma',
                entityId: proformaId,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/sales/proforma');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function unarchiveProformaInvoice(proformaId: string): Promise<{ success: boolean; error?: string }> {
    if (!proformaId || !ObjectId.isValid(proformaId)) return { success: false, error: 'Invalid id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const guard = await requirePermission('crm_proforma_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_proforma_invoices').updateOne(
            { _id: new ObjectId(proformaId), userId: new ObjectId(session.user._id) },
            { $set: { archived: false, updatedAt: new Date() } },
        );
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'restore',
                entityKind: 'proforma',
                entityId: proformaId,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/sales/proforma');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteProformaInvoice(proformaId: string): Promise<{ success: boolean; error?: string }> {
    if (!proformaId || !ObjectId.isValid(proformaId)) return { success: false, error: 'Invalid id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const guard = await requirePermission('crm_proforma_invoice', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_proforma_invoices').deleteOne({
            _id: new ObjectId(proformaId),
            userId: new ObjectId(session.user._id),
        });
        if (result.deletedCount === 0) return { success: false, error: 'Proforma not found.' };
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'proforma',
                entityId: proformaId,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/sales/proforma');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Canonical Rust-backed list + delete (§1B contract) ─────────────── */

import type { CrmProformaInvoiceDoc, CrmProformaStatus } from '@/lib/rust-client/crm-proforma-invoices';

interface ProformaListResult {
    items: CrmProformaInvoiceDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

/**
 * Canonical Rust-backed list call used by the client-side
 * `/dashboard/crm/sales/proforma` list page.
 */
export async function listProformaInvoices(params?: {
    page?: number;
    limit?: number;
    q?: string;
    status?: CrmProformaStatus | 'all';
    accountId?: string;
}): Promise<ProformaListResult> {
    const empty: ProformaListResult = { items: [], page: 1, limit: 50, hasMore: false };
    const session = await getSession();
    if (!session?.user) return empty;
    const guard = await requirePermission('crm_proforma_invoice', 'view');
    if (!guard.ok) return empty;

    try {
        const res = await crmProformaInvoicesApi.list(params);
        return res;
    } catch (e) {
        console.error('[listProformaInvoices] rust failed:', e);
        recordRustFallback({
            entity: 'proforma_invoice',
            op: 'list',
            errorCode: e instanceof RustApiError ? e.code : undefined,
            status: e instanceof RustApiError ? e.status : undefined,
        });
        // Soft fallback to mongo path for resilience.
        try {
            const { invoices } = await getProformaInvoices(params?.page ?? 1, params?.limit ?? 50, {
                query: params?.q,
                status: params?.status === 'all' ? undefined : params?.status,
            });
            return {
                items: invoices as unknown as CrmProformaInvoiceDoc[],
                page: params?.page ?? 1,
                limit: params?.limit ?? 50,
                hasMore: invoices.length === (params?.limit ?? 50),
            };
        } catch {
            return empty;
        }
    }
}

export async function convertProformaToInvoice(
    proformaId: string,
    invoiceId?: string,
): Promise<{ success: boolean; error?: string }> {
    if (!proformaId || !ObjectId.isValid(proformaId)) return { success: false, error: 'Invalid id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const guard = await requirePermission('crm_proforma_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const $set: Record<string, any> = { status: 'Converted', updatedAt: new Date() };
        if (invoiceId && ObjectId.isValid(invoiceId)) {
            $set.convertedInvoiceId = new ObjectId(invoiceId);
        }
        const result = await db.collection('crm_proforma_invoices').updateOne(
            { _id: new ObjectId(proformaId), userId: new ObjectId(session.user._id) },
            { $set },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Proforma not found.' };
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'convert',
                entityKind: 'proforma',
                entityId: proformaId,
                reason: invoiceId ? `→ invoice ${invoiceId}` : 'converted to invoice',
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/crm/sales/proforma');
        revalidatePath(`/dashboard/crm/sales/proforma/${proformaId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function patchProformaInvoice(
    id: string,
    patch: any,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    const guard = await requirePermission('crm_proforma_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmProformaInvoicesApi.update(id, patch);
            revalidatePath('/dashboard/crm/sales/proforma');
            revalidatePath(`/dashboard/crm/sales/proforma/${id}`);
            return { success: true };
        } catch (e) {
            console.error('[patchProformaInvoice] rust failed:', e);
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const $set: Record<string, any> = { updatedAt: new Date() };
        if (patch.proformaNumber) $set.proformaNumber = patch.proformaNumber;
        if (patch.proformaDate) $set.proformaDate = new Date(patch.proformaDate);
        if (patch.validTillDate) $set.validTillDate = new Date(patch.validTillDate);
        if (patch.currency) $set.currency = patch.currency;
        if (patch.notes !== undefined) $set.notes = patch.notes;
        if (patch.status) $set.status = patch.status;
        if (patch.total !== undefined) {
            $set.total = Number(patch.total);
            $set.subtotal = Number(patch.total);
        }
        if (patch.lineItems) {
            $set.lineItems = patch.lineItems;
        }

        const result = await db.collection('crm_proforma_invoices').updateOne(
            { _id: new ObjectId(id), userId: userObjectId },
            { $set },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Proforma not found.' };

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'proforma',
                entityId: id,
            });
        } catch {
            // non-fatal
        }

        revalidatePath('/dashboard/crm/sales/proforma');
        revalidatePath(`/dashboard/crm/sales/proforma/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

