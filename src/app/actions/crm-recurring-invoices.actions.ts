'use server';

/**
 * CRM Recurring Invoices — server actions.
 *
 * This entity has NO Rust crate yet. Reads + writes go directly to
 * the `crm_recurring_invoices` Mongo collection (multi-tenant by
 * `userId`). RBAC key: `crm_recurring_invoice`.
 *
 * Document shape (camelCase Mongo fields):
 *   - invoiceTemplateId   ObjectId  — invoice template to clone each run
 *   - customerId          ObjectId  — billing customer (`crm_accounts`)
 *   - frequency           string    — daily | weekly | monthly | quarterly | yearly
 *   - startDate           Date      — first run date
 *   - endDate?            Date      — optional stop date
 *   - nextRunAt?          Date      — scheduled next run (computed)
 *   - lastRunAt?          Date      — last successful run
 *   - totalRuns?          number    — runs executed so far
 *   - status              string    — active | paused | stopped | completed
 *   - title?              string    — display label
 *   - notes?              string
 *   - createdAt, updatedAt
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
    crmRecurringInvoicesApi,
    type CrmRecurringInvoiceCreateInput,
    type CrmRecurringInvoiceUpdateInput,
} from '@/lib/rust-client/crm-recurring-invoices';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types (TS-only, mirror the Mongo doc) ──────────────────────────── */

type CrmRecurringInvoiceStatus = 'active' | 'paused' | 'stopped' | 'completed';

type CrmRecurringInvoiceFrequency =
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'quarterly'
    | 'yearly';

interface CrmRecurringInvoiceDoc {
    _id: string;
    userId?: string;
    title?: string;
    invoiceTemplateId?: string;
    customerId?: string;
    frequency: CrmRecurringInvoiceFrequency;
    startDate?: string;
    endDate?: string;
    nextRunAt?: string;
    lastRunAt?: string;
    totalRuns?: number;
    status: CrmRecurringInvoiceStatus;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmRecurringInvoiceListParams {
    q?: string;
    status?: CrmRecurringInvoiceStatus | 'all';
    limit?: number;
}

interface CrmRecurringInvoiceListResponse {
    items: CrmRecurringInvoiceDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asObjectId(v: FormDataEntryValue | null): ObjectId | undefined {
    const s = asString(v);
    if (!s || !ObjectId.isValid(s)) return undefined;
    return new ObjectId(s);
}

const VALID_FREQS: ReadonlySet<CrmRecurringInvoiceFrequency> = new Set([
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'yearly',
]);

const VALID_STATUSES: ReadonlySet<CrmRecurringInvoiceStatus> = new Set([
    'active',
    'paused',
    'stopped',
    'completed',
]);

function pickFrequency(raw: string | undefined): CrmRecurringInvoiceFrequency {
    return raw && VALID_FREQS.has(raw as CrmRecurringInvoiceFrequency)
        ? (raw as CrmRecurringInvoiceFrequency)
        : 'monthly';
}

function pickStatus(raw: string | undefined): CrmRecurringInvoiceStatus | undefined {
    return raw && VALID_STATUSES.has(raw as CrmRecurringInvoiceStatus)
        ? (raw as CrmRecurringInvoiceStatus)
        : undefined;
}

/** Add one calendar-period step to `from`. */
function advance(from: Date, freq: CrmRecurringInvoiceFrequency): Date {
    const d = new Date(from);
    switch (freq) {
        case 'daily':
            d.setUTCDate(d.getUTCDate() + 1);
            break;
        case 'weekly':
            d.setUTCDate(d.getUTCDate() + 7);
            break;
        case 'monthly':
            d.setUTCMonth(d.getUTCMonth() + 1);
            break;
        case 'quarterly':
            d.setUTCMonth(d.getUTCMonth() + 3);
            break;
        case 'yearly':
            d.setUTCFullYear(d.getUTCFullYear() + 1);
            break;
    }
    return d;
}

function serialize(
    doc: WithId<Record<string, unknown>>,
): CrmRecurringInvoiceDoc {
    return JSON.parse(JSON.stringify(doc)) as CrmRecurringInvoiceDoc;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getRecurringInvoices(
    filters?: CrmRecurringInvoiceListParams,
): Promise<CrmRecurringInvoiceListResponse> {
    const empty: CrmRecurringInvoiceListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user?._id) return empty;

    const guard = await requirePermission('crm_recurring_invoice', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmRecurringInvoicesApi.list({
                q: filters?.q,
                status: filters?.status,
                limit: filters?.limit,
            });
            return {
                items: JSON.parse(JSON.stringify(res.items ?? [])) as CrmRecurringInvoiceDoc[],
                page: res.page ?? 1,
                limit: res.limit ?? (filters?.limit ?? 50),
                hasMore: res.hasMore ?? false,
            };
        } catch (e) {
            console.error('[getRecurringInvoices] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recurring_invoice',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);
        const filter: Record<string, unknown> = { userId };

        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }
        const q = filters?.q?.trim();
        if (q) {
            const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ title: re }, { notes: re }];
        }

        const limit = Math.min(Math.max(1, filters?.limit ?? 50), 200);
        const docs = await db
            .collection('crm_recurring_invoices')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();

        return {
            items: docs.map(serialize),
            page: 1,
            limit,
            hasMore: docs.length === limit,
        };
    } catch (e) {
        console.error('[getRecurringInvoices] failed:', e);
        return empty;
    }
}

export async function getRecurringInvoiceById(
    id: string,
): Promise<CrmRecurringInvoiceDoc | null> {
    if (!id || !ObjectId.isValid(id)) return null;

    const session = await getSession();
    if (!session?.user?._id) return null;

    const guard = await requirePermission('crm_recurring_invoice', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmRecurringInvoicesApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmRecurringInvoiceDoc;
        } catch (e) {
            console.error('[getRecurringInvoiceById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recurring_invoice',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_recurring_invoices').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return doc ? serialize(doc) : null;
    } catch (e) {
        console.error('[getRecurringInvoiceById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveRecurringInvoice(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { error: 'Access denied.' };

    const recurringId = asString(formData.get('recurringId'));
    const isEditing = !!recurringId;

    const guard = await requirePermission(
        'crm_recurring_invoice',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const customerId = asObjectId(formData.get('customerId'));
    if (!customerId) return { error: 'Customer is required.' };

    const invoiceTemplateId = asObjectId(formData.get('invoiceTemplateId'));
    const frequency = pickFrequency(asString(formData.get('frequency')));

    const startDateRaw = asString(formData.get('startDate'));
    if (!startDateRaw) return { error: 'Start date is required.' };
    const startDate = new Date(startDateRaw);
    if (Number.isNaN(startDate.getTime())) return { error: 'Start date is invalid.' };

    const endDateRaw = asString(formData.get('endDate'));
    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) return { error: 'End date is invalid.' };

    const status = pickStatus(asString(formData.get('status'))) ?? 'active';
    const title = asString(formData.get('title'));
    const notes = asString(formData.get('notes'));

    if (useRustCrm()) {
        try {
            if (isEditing && recurringId && ObjectId.isValid(recurringId)) {
                const patch: CrmRecurringInvoiceUpdateInput = {
                    customerId: customerId.toString(),
                    frequency,
                    startDate: startDate.toISOString(),
                    status,
                };
                if (invoiceTemplateId) patch.invoiceTemplateId = invoiceTemplateId.toString();
                if (endDate) patch.endDate = endDate.toISOString();
                if (title) patch.title = title;
                if (notes !== undefined) patch.notes = notes;

                await crmRecurringInvoicesApi.update(recurringId, patch);

                try {
                    await writeAuditEntry({
                        tenantUserId: String(session.user._id),
                        actorId: String(session.user._id),
                        action: 'update',
                        entityKind: 'recurring_invoice',
                        entityId: recurringId,
                    });
                } catch {
                    /* non-fatal */
                }

                revalidatePath('/dashboard/crm/sales/recurring-invoices');
                revalidatePath(`/dashboard/crm/sales/recurring-invoices/${recurringId}`);
                return { message: 'Recurring invoice updated.', id: recurringId };
            }

            const input: CrmRecurringInvoiceCreateInput = {
                customerId: customerId.toString(),
                frequency,
                startDate: startDate.toISOString(),
                status,
            };
            if (invoiceTemplateId) input.invoiceTemplateId = invoiceTemplateId.toString();
            if (endDate) input.endDate = endDate.toISOString();
            if (title) input.title = title;
            if (notes) input.notes = notes;

            const created = await crmRecurringInvoicesApi.create(input);

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'recurring_invoice',
                    entityId: created.id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/recurring-invoices');
            return { message: 'Recurring invoice created.', id: created.id };
        } catch (e) {
            console.error('[saveRecurringInvoice] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recurring_invoice',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing && recurringId && ObjectId.isValid(recurringId)) {
            const $set: Record<string, unknown> = {
                customerId,
                frequency,
                startDate,
                status,
                updatedAt: now,
            };
            if (invoiceTemplateId) $set.invoiceTemplateId = invoiceTemplateId;
            if (endDate) $set.endDate = endDate;
            if (title) $set.title = title;
            if (notes !== undefined) $set.notes = notes;

            const result = await db.collection('crm_recurring_invoices').updateOne(
                { _id: new ObjectId(recurringId), userId },
                { $set },
            );
            if (result.matchedCount === 0) {
                return { error: 'Recurring invoice not found.' };
            }

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'recurring_invoice',
                    entityId: recurringId,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/recurring-invoices');
            revalidatePath(`/dashboard/crm/sales/recurring-invoices/${recurringId}`);
            return { message: 'Recurring invoice updated.', id: recurringId };
        }

        const doc: Record<string, unknown> = {
            userId,
            customerId,
            frequency,
            startDate,
            nextRunAt: startDate,
            status,
            totalRuns: 0,
            createdAt: now,
            updatedAt: now,
        };
        if (invoiceTemplateId) doc.invoiceTemplateId = invoiceTemplateId;
        if (endDate) doc.endDate = endDate;
        if (title) doc.title = title;
        if (notes) doc.notes = notes;

        const insertResult = await db.collection('crm_recurring_invoices').insertOne(doc);
        const insertedId = insertResult.insertedId.toString();

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'recurring_invoice',
                entityId: insertedId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/recurring-invoices');
        return { message: 'Recurring invoice created.', id: insertedId };
    } catch (e) {
        console.error('[saveRecurringInvoice] failed:', e);
        return { error: e instanceof Error ? e.message : 'Failed to save recurring invoice.' };
    }
}

export async function deleteRecurringInvoice(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_recurring_invoice', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmRecurringInvoicesApi.delete(id);

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'recurring_invoice',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/recurring-invoices');
            return { success: true };
        } catch (e) {
            console.error('[deleteRecurringInvoice] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recurring_invoice',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_recurring_invoices').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount === 0) {
            return { success: false, error: 'Recurring invoice not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'recurring_invoice',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/recurring-invoices');
        return { success: true };
    } catch (e) {
        console.error('[deleteRecurringInvoice] failed:', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Failed to delete recurring invoice.',
        };
    }
}

/* ─── setRecurringInvoiceStatus ──────────────────────────────────────── */

export async function setRecurringInvoiceStatus(
    id: string,
    status: CrmRecurringInvoiceStatus,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_recurring_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!VALID_STATUSES.has(status)) {
        return { success: false, error: `Invalid status: ${status}` };
    }

    if (useRustCrm()) {
        try {
            await crmRecurringInvoicesApi.update(id, { status } as CrmRecurringInvoiceUpdateInput);
            revalidatePath('/dashboard/crm/sales/recurring-invoices');
            return { success: true };
        } catch (e) {
            console.error('[setRecurringInvoiceStatus] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'recurring_invoice',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_recurring_invoices').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(session.user._id as string) },
            { $set: { status, updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Recurring invoice not found.' };
        }
        revalidatePath('/dashboard/crm/sales/recurring-invoices');
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Failed to update status.',
        };
    }
}

/* ─── bulkSetRecurringInvoiceStatus ──────────────────────────────────── */

export async function bulkSetRecurringInvoiceStatus(
    ids: string[],
    status: CrmRecurringInvoiceStatus,
): Promise<{ processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { processed: 0, error: 'Access denied.' };

    const guard = await requirePermission('crm_recurring_invoice', 'edit');
    if (!guard.ok) return { processed: 0, error: guard.error };

    if (!VALID_STATUSES.has(status)) {
        return { processed: 0, error: `Invalid status: ${status}` };
    }

    const validIds = ids.filter((id) => typeof id === 'string' && ObjectId.isValid(id));
    if (validIds.length === 0) return { processed: 0, error: 'No valid ids.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_recurring_invoices').updateMany(
            {
                _id: { $in: validIds.map((id) => new ObjectId(id)) },
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status, updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/crm/sales/recurring-invoices');
        return { processed: result.modifiedCount };
    } catch (e) {
        return {
            processed: 0,
            error: e instanceof Error ? e.message : 'Failed to update status.',
        };
    }
}

/**
 * Helper exposed for the daily cron — advances `nextRunAt` to the
 * subsequent calendar slot and bumps `totalRuns`. Not directly bound
 * to any form, but kept in this module so the math lives next to the
 * status/frequency enums.
 */
export async function tickRecurringInvoice(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!id || !ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_recurring_invoice', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);
        const doc = await db.collection('crm_recurring_invoices').findOne({
            _id: new ObjectId(id),
            userId,
        });
        if (!doc) return { success: false, error: 'Recurring invoice not found.' };

        const freq = pickFrequency(doc.frequency as string | undefined);
        const base = (doc.nextRunAt as Date | undefined) ?? (doc.startDate as Date) ?? new Date();
        const next = advance(base, freq);
        const totalRuns = (doc.totalRuns as number | undefined) ?? 0;

        await db.collection('crm_recurring_invoices').updateOne(
            { _id: new ObjectId(id), userId },
            {
                $set: {
                    nextRunAt: next,
                    lastRunAt: new Date(),
                    totalRuns: totalRuns + 1,
                    updatedAt: new Date(),
                },
            },
        );

        revalidatePath('/dashboard/crm/sales/recurring-invoices');
        revalidatePath(`/dashboard/crm/sales/recurring-invoices/${id}`);
        return { success: true };
    } catch (e) {
        console.error('[tickRecurringInvoice] failed:', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : 'Failed to advance schedule.',
        };
    }
}
