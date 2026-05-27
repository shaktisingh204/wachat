'use server';

/**
 * CRM Sales Estimate Requests — Mongo-backed server actions.
 *
 * No Rust crate exists for this entity. We persist to the
 * `crm_estimate_requests` collection and follow the canonical pattern:
 *   getSession + requirePermission + connectToDatabase + writeAuditEntry
 *   + soft-delete (status='archived').
 *
 * Field shape:
 *   - customerName, customerEmail
 *   - requirements (long text)
 *   - budgetRange (free text, e.g. "10000-20000 INR")
 *   - deadline (Date)
 *   - source ('web' | 'email' | 'phone' | 'referral' | 'other')
 *   - status ('pending' | 'in_review' | 'quoted' | 'declined' | 'archived')
 *   - assignedToId (user id)
 *   - notes
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
    crmEstimateRequestsApi,
    type CrmEstimateRequestCreateInput,
    type CrmEstimateRequestUpdateInput,
} from '@/lib/rust-client/crm-estimate-requests';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ─────────────────────────────────────────────────────────── */

type CrmEstimateRequestStatus =
    | 'pending'
    | 'in_review'
    | 'quoted'
    | 'declined'
    | 'archived';

type CrmEstimateRequestSource =
    | 'web'
    | 'email'
    | 'phone'
    | 'referral'
    | 'other';

interface CrmEstimateRequestListFilters {
    q?: string;
    status?: CrmEstimateRequestStatus | 'all';
    limit?: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

const VALID_STATUSES = new Set<CrmEstimateRequestStatus>([
    'pending',
    'in_review',
    'quoted',
    'declined',
    'archived',
]);

const VALID_SOURCES = new Set<CrmEstimateRequestSource>([
    'web',
    'email',
    'phone',
    'referral',
    'other',
]);

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getEstimateRequests(
    filters?: CrmEstimateRequestListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_estimate_request', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmEstimateRequestsApi.list({
                q: filters?.q,
                status: filters?.status,
                limit: filters?.limit,
            });
            return {
                items: JSON.parse(JSON.stringify(res.items ?? [])),
                total: (res.items ?? []).length,
            };
        } catch (e) {
            console.error('[getEstimateRequests] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'estimate_request',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);

        const filter: Record<string, unknown> = { userId: userObjectId };
        const status = filters?.status;
        if (status && status !== 'all') {
            filter.status = status;
        } else {
            filter.status = { $ne: 'archived' };
        }

        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [
                { customerName: re },
                { customerEmail: re },
                { requirements: re },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_estimate_requests')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db
            .collection('crm_estimate_requests')
            .countDocuments(filter);
        return {
            items: JSON.parse(JSON.stringify(docs)),
            total,
        };
    } catch (e) {
        console.error('[getEstimateRequests] failed:', e);
        return empty;
    }
}

export async function getEstimateRequestById(
    requestId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!requestId || !ObjectId.isValid(requestId)) return null;

    const guard = await requirePermission('crm_estimate_request', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmEstimateRequestsApi.getById(requestId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getEstimateRequestById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'estimate_request',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_estimate_requests').findOne({
            _id: new ObjectId(requestId),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getEstimateRequestById] failed:', e);
        return null;
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

export async function saveEstimateRequest(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const requestId = asString(formData.get('requestId'));
    const isEditing = !!requestId;

    const guard = await requirePermission(
        'crm_estimate_request',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const customerName = asString(formData.get('customerName'));
    if (!customerName) return { error: 'Customer name is required.' };

    const requirements = asString(formData.get('requirements'));
    if (!requirements) return { error: 'Requirements are required.' };

    const customerEmail = asString(formData.get('customerEmail'));
    const budgetRange = asString(formData.get('budgetRange'));
    const deadlineRaw = asString(formData.get('deadline'));
    const deadline = deadlineRaw ? new Date(deadlineRaw) : undefined;
    const assignedToId = asString(formData.get('assignedToId'));
    const notes = asString(formData.get('notes'));

    const sourceRaw = asString(formData.get('source'));
    const source: CrmEstimateRequestSource =
        sourceRaw && VALID_SOURCES.has(sourceRaw as CrmEstimateRequestSource)
            ? (sourceRaw as CrmEstimateRequestSource)
            : 'web';

    const statusRaw = asString(formData.get('status'));
    const status: CrmEstimateRequestStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmEstimateRequestStatus)
            ? (statusRaw as CrmEstimateRequestStatus)
            : 'pending';

    if (useRustCrm()) {
        try {
            if (isEditing) {
                if (!ObjectId.isValid(requestId!)) {
                    return { error: 'Invalid request id.' };
                }
                const patch: CrmEstimateRequestUpdateInput = {
                    customerName,
                    requirements,
                    source,
                    status,
                };
                if (customerEmail !== undefined) patch.customerEmail = customerEmail;
                if (budgetRange !== undefined) patch.budgetRange = budgetRange;
                if (deadline && !Number.isNaN(deadline.getTime())) {
                    patch.deadline = deadline.toISOString();
                }
                if (assignedToId !== undefined) patch.assignedToId = assignedToId;
                if (notes !== undefined) patch.notes = notes;

                await crmEstimateRequestsApi.update(requestId!, patch);

                try {
                    await writeAuditEntry({
                        tenantUserId: String(session.user._id),
                        actorId: String(session.user._id),
                        action: 'update',
                        entityKind: 'estimate_request',
                        entityId: requestId!,
                    });
                } catch {
                    /* non-fatal */
                }

                revalidatePath('/dashboard/crm/sales/estimate-requests');
                revalidatePath(
                    `/dashboard/crm/sales/estimate-requests/${requestId}`,
                );
                return { message: 'Estimate request updated.', id: requestId };
            }

            const input: CrmEstimateRequestCreateInput = {
                customerName,
                requirements,
                source,
                status,
            };
            if (customerEmail) input.customerEmail = customerEmail;
            if (budgetRange) input.budgetRange = budgetRange;
            if (deadline && !Number.isNaN(deadline.getTime())) {
                input.deadline = deadline.toISOString();
            }
            if (assignedToId) input.assignedToId = assignedToId;
            if (notes) input.notes = notes;

            const created = await crmEstimateRequestsApi.create(input);

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'estimate_request',
                    entityId: created.id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/estimate-requests');
            return { message: 'Estimate request created.', id: created.id };
        } catch (e) {
            console.error('[saveEstimateRequest] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'estimate_request',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing) {
            if (!ObjectId.isValid(requestId!)) {
                return { error: 'Invalid request id.' };
            }
            const existing = await db
                .collection('crm_estimate_requests')
                .findOne({
                    _id: new ObjectId(requestId!),
                    userId: userObjectId,
                });
            if (!existing) return { error: 'Estimate request not found.' };

            const $set: Record<string, unknown> = {
                customerName,
                ...(customerEmail !== undefined ? { customerEmail } : {}),
                requirements,
                ...(budgetRange !== undefined ? { budgetRange } : {}),
                ...(deadline && !Number.isNaN(deadline.getTime())
                    ? { deadline }
                    : { deadline: null }),
                source,
                status,
                ...(assignedToId !== undefined ? { assignedToId } : {}),
                ...(notes !== undefined ? { notes } : {}),
                updatedAt: now,
            };

            await db.collection('crm_estimate_requests').updateOne(
                { _id: new ObjectId(requestId!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'estimate_request',
                    entityId: requestId!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/estimate-requests');
            revalidatePath(
                `/dashboard/crm/sales/estimate-requests/${requestId}`,
            );
            return {
                message: 'Estimate request updated.',
                id: requestId,
            };
        }

        const doc: Record<string, unknown> = {
            userId: userObjectId,
            customerName,
            ...(customerEmail ? { customerEmail } : {}),
            requirements,
            ...(budgetRange ? { budgetRange } : {}),
            ...(deadline && !Number.isNaN(deadline.getTime())
                ? { deadline }
                : {}),
            source,
            status,
            ...(assignedToId ? { assignedToId } : {}),
            ...(notes ? { notes } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db
            .collection('crm_estimate_requests')
            .insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'estimate_request',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/estimate-requests');
        return {
            message: 'Estimate request created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return {
            error: `Failed to save estimate request: ${getErrorMessage(e)}`,
        };
    }
}

export async function deleteEstimateRequest(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid request id.' };
    }

    const guard = await requirePermission('crm_estimate_request', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmEstimateRequestsApi.delete(id);

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'estimate_request',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/estimate-requests');
            return { success: true };
        } catch (e) {
            console.error('[deleteEstimateRequest] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'estimate_request',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_estimate_requests').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Estimate request not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'estimate_request',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/estimate-requests');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
