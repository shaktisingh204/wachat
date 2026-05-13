'use server';

/**
 * CRM RFQ server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, mutations delegate to
 *    `/v1/crm/rfqs` on the Rust BFF via
 *    `src/lib/rust-client/crm-rfqs.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/crm/rfqs/**` (and the purchase RFQ flows) keep working
 * without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmRfq, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { crmRfqsApi, type CrmRfqDoc, type CrmRfqLineItem } from '@/lib/rust-client/crm-rfqs';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/** Map the Rust DTO to the loose WithId<CrmRfq> shape legacy callers expect. */
function rustDocToLegacy(doc: CrmRfqDoc): WithId<CrmRfq> {
    return JSON.parse(JSON.stringify(doc)) as WithId<CrmRfq>;
}

/**
 * List all RFQs for the current tenant (newest first). Mirrors the
 * tenant scoping used by the other CRM action modules — every query
 * is keyed off `userId` derived from the active session.
 */
export async function getRfqs(): Promise<WithId<CrmRfq>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const rfqs = await crmRfqsApi.list({ page: 0, limit: 200 });
            return rfqs.map(rustDocToLegacy);
        } catch (e) {
            console.error('[getRfqs] rust path failed; falling back:', e);
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const rfqs = await db.collection<CrmRfq>('crm_rfqs')
            .find({ userId: userObjectId })
            .sort({ createdAt: -1 })
            .toArray();

        return JSON.parse(JSON.stringify(rfqs));
    } catch (e) {
        console.error('Failed to fetch CRM RFQs:', e);
        return [];
    }
}

/**
 * Fetch a single RFQ by id, scoped to the current tenant. Returns
 * `null` if the id is malformed, the doc doesn't exist, or it lives
 * under a different user.
 */
export async function getRfqById(rfqId: string): Promise<WithId<CrmRfq> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!rfqId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmRfqsApi.getById(rfqId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getRfqById] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(rfqId)) return null;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const rfq = await db.collection<CrmRfq>('crm_rfqs').findOne({
            _id: new ObjectId(rfqId),
            userId: userObjectId,
        });

        if (!rfq) return null;
        return JSON.parse(JSON.stringify(rfq));
    } catch (e) {
        console.error('Failed to fetch CRM RFQ:', e);
        return null;
    }
}

/**
 * Create a new RFQ from form data. Mirrors the lineage-seed pattern
 * from `saveInvoice` (crm_function_plan.md §13.5): when the form
 * supplies `fromKind` + `fromId`, we copy the parent's lineage,
 * append the parent itself, and then back-link the new RFQ on to
 * the parent doc. Allowed parent kinds for an RFQ are `lead` and
 * `deal`.
 */
export async function saveRfq(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_rfq', 'create');
    if (!guard.ok) return { error: guard.error };

    const title = (formData.get('title') as string | null)?.trim() || '';
    if (!title) {
        return { error: 'Title is required.' };
    }

    if (useRustCrm()) {
        try {
            // Items — JSON array. Rust requires a valid `itemId` per row.
            const itemsRaw = formData.get('items') as string | null;
            let items: CrmRfqLineItem[] = [];
            if (itemsRaw) {
                try {
                    const parsed = JSON.parse(itemsRaw);
                    if (Array.isArray(parsed)) {
                        items = parsed
                            .filter((it: any) => it && typeof it.itemId === 'string' && it.itemId)
                            .map((it: any) => ({
                                itemId: String(it.itemId),
                                qty: Number(it.qty) || 0,
                                ...(typeof it.description === 'string' && it.description
                                    ? { description: it.description }
                                    : {}),
                                ...(typeof it.unit === 'string' && it.unit ? { unit: it.unit } : {}),
                                ...(typeof it.specs === 'string' && it.specs ? { specs: it.specs } : {}),
                            }));
                    }
                } catch {
                    // ignore malformed JSON
                }
            }

            // Vendors invited
            const vendorsRaw = formData.get('vendorsInvited') as string | null;
            let vendorsInvited: string[] | undefined;
            if (vendorsRaw) {
                try {
                    const parsed = JSON.parse(vendorsRaw);
                    if (Array.isArray(parsed)) {
                        vendorsInvited = parsed.filter(
                            (v: any): v is string => typeof v === 'string' && !!v,
                        );
                    }
                } catch {
                    /* ignore */
                }
            }

            // Attachments
            const attachmentsRaw = formData.get('attachments') as string | null;
            let attachments: { fileId: string }[] | undefined;
            if (attachmentsRaw) {
                try {
                    const parsed = JSON.parse(attachmentsRaw);
                    if (Array.isArray(parsed)) {
                        attachments = parsed
                            .filter((u: any): u is string => typeof u === 'string' && !!u)
                            .map((id) => ({ fileId: id }));
                    }
                } catch {
                    /* ignore */
                }
            }

            const requiredByRaw = formData.get('requiredBy') as string | null;
            const deadlineRaw = formData.get('deadline') as string | null;
            const terms = (formData.get('terms') as string | null) || undefined;
            const projectIdRaw = formData.get('projectId') as string | null;
            const fromKind = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            const created = await crmRfqsApi.create({
                title,
                items,
                ...(requiredByRaw ? { requiredBy: new Date(requiredByRaw).toISOString() } : {}),
                ...(vendorsInvited && vendorsInvited.length ? { vendorsInvited } : {}),
                ...(terms ? { terms } : {}),
                ...(deadlineRaw ? { deadline: new Date(deadlineRaw).toISOString() } : {}),
                ...(attachments && attachments.length ? { attachments } : {}),
                ...(projectIdRaw ? { projectId: projectIdRaw } : {}),
                ...(fromKind && fromId ? { fromKind, fromId } : {}),
            });

            const id = String(created._id ?? '');
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'rfq',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/rfqs');
            return { message: 'RFQ saved successfully.' };
        } catch (e) {
            if (e instanceof RustApiError) {
                console.error('[saveRfq] rust path failed; falling back:', e);
            } else {
                console.error('[saveRfq] rust path failed; falling back:', e);
            }
            // fall through to legacy
        }
    }

    try {
        // Items — JSON array of { itemId?, description?, qty, unit?, specs? }.
        let items: CrmRfq['items'] = [];
        const itemsRaw = formData.get('items') as string | null;
        if (itemsRaw) {
            try {
                const parsed = JSON.parse(itemsRaw);
                if (Array.isArray(parsed)) {
                    items = parsed.map((it: any) => ({
                        ...(it.itemId && ObjectId.isValid(it.itemId)
                            ? { itemId: new ObjectId(it.itemId) }
                            : {}),
                        ...(typeof it.description === 'string' && it.description
                            ? { description: it.description }
                            : {}),
                        qty: Number(it.qty) || 0,
                        ...(typeof it.unit === 'string' && it.unit ? { unit: it.unit } : {}),
                        ...(typeof it.specs === 'string' && it.specs ? { specs: it.specs } : {}),
                    }));
                }
            } catch {
                // ignore malformed JSON — items stays []
            }
        }

        // Vendors invited — JSON array of ObjectId hex strings.
        let vendorsInvited: ObjectId[] = [];
        const vendorsRaw = formData.get('vendorsInvited') as string | null;
        if (vendorsRaw) {
            try {
                const parsed = JSON.parse(vendorsRaw);
                if (Array.isArray(parsed)) {
                    vendorsInvited = parsed
                        .filter((v): v is string => typeof v === 'string' && ObjectId.isValid(v))
                        .map((v) => new ObjectId(v));
                }
            } catch {
                // ignore malformed JSON — vendors stays []
            }
        }

        // Attachments — JSON array of file ids/strings.
        let attachments: string[] | undefined;
        const attachmentsRaw = formData.get('attachments') as string | null;
        if (attachmentsRaw) {
            try {
                const parsed = JSON.parse(attachmentsRaw);
                if (Array.isArray(parsed)) {
                    const cleaned = parsed.filter(
                        (u): u is string => typeof u === 'string' && !!u,
                    );
                    if (cleaned.length) attachments = cleaned;
                }
            } catch {
                // ignore malformed JSON
            }
        }

        const requiredByRaw = formData.get('requiredBy') as string | null;
        const deadlineRaw = formData.get('deadline') as string | null;
        const terms = (formData.get('terms') as string | null) || undefined;
        const projectIdRaw = formData.get('projectId') as string | null;

        const userObjectId = new ObjectId(session.user._id);

        const rfqData: Omit<CrmRfq, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            // `projectId` is required on the type. Fall back to the
            // user's own id when no project is supplied so single-
            // project tenants don't have to thread it through.
            projectId: projectIdRaw && ObjectId.isValid(projectIdRaw)
                ? new ObjectId(projectIdRaw)
                : userObjectId,
            title,
            items,
            vendorsInvited,
            ...(requiredByRaw ? { requiredBy: new Date(requiredByRaw) } : {}),
            ...(terms ? { terms } : {}),
            ...(deadlineRaw ? { deadline: new Date(deadlineRaw) } : {}),
            status: 'draft',
            ...(attachments ? { attachments } : {}),
        };

        const { db } = await connectToDatabase();

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when an RFQ is created
        // in the context of a parent doc (Lead or Deal). Both fields
        // are optional, so existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['lead', 'deal'];
        if (
            fromKind &&
            fromId &&
            ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) &&
            ObjectId.isValid(fromId)
        ) {
            const parentCollection: Record<string, string> = {
                lead: 'crm_leads',
                deal: 'crm_deals',
            };
            const parentNoField: Record<string, string> = {
                lead: 'title',
                deal: 'name',
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
                // ignore lineage seed failures — RFQ still saves
            }
        }

        const insertResult = await db.collection('crm_rfqs').insertOne({
            ...rfqData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    lead: 'crm_leads',
                    deal: 'crm_deals',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(
                    parent?.lineage as LineageRef[] | undefined,
                    {
                        kind: 'rfq',
                        id: insertResult.insertedId.toString(),
                        no: rfqData.title,
                        status: rfqData.status,
                        createdAt: new Date().toISOString(),
                    },
                );
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
                entityKind: 'rfq',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/rfqs');
        return { message: 'RFQ saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Patch the status of an RFQ and bump `updatedAt`. Tenant-scoped so
 * users can only mutate their own docs.
 */
export async function updateRfqStatus(
    rfqId: string,
    status: 'draft' | 'open' | 'closed' | 'awarded' | 'cancelled',
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_rfq', 'edit');
    if (!guard.ok) return { error: guard.error };

    if (!rfqId) return { error: 'Invalid RFQ id.' };

    const allowed: ReadonlyArray<typeof status> = [
        'draft',
        'open',
        'closed',
        'awarded',
        'cancelled',
    ];
    if (!allowed.includes(status)) {
        return { error: 'Invalid status.' };
    }

    if (useRustCrm()) {
        try {
            await crmRfqsApi.update(rfqId, { status });
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'status_change',
                    entityKind: 'rfq',
                    entityId: rfqId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/rfqs');
            return { message: 'RFQ status updated.' };
        } catch (e) {
            console.error('[updateRfqStatus] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(rfqId)) return { error: 'Invalid RFQ id.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const result = await db.collection('crm_rfqs').updateOne(
            { _id: new ObjectId(rfqId), userId: userObjectId },
            { $set: { status, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { error: 'RFQ not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'rfq',
                entityId: rfqId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/rfqs');
        return { message: 'RFQ status updated.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Soft-delete an RFQ by flipping `archived: true`. We never
 * physically remove the doc so lineage chains that reference it
 * stay intact.
 */
export async function deleteRfq(
    rfqId: string,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_rfq', 'delete');
    if (!guard.ok) return { error: guard.error };

    if (!rfqId) return { error: 'Invalid RFQ id.' };

    if (useRustCrm()) {
        try {
            await crmRfqsApi.delete(rfqId);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'rfq',
                    entityId: rfqId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/rfqs');
            return { message: 'RFQ deleted.' };
        } catch (e) {
            console.error('[deleteRfq] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(rfqId)) return { error: 'Invalid RFQ id.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const result = await db.collection('crm_rfqs').updateOne(
            { _id: new ObjectId(rfqId), userId: userObjectId },
            { $set: { archived: true, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { error: 'RFQ not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'rfq',
                entityId: rfqId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/rfqs');
        return { message: 'RFQ deleted.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
