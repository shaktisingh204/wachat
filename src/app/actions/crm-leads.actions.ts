

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmLead, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';

function revalidateLeadSurfaces(leadId?: string): void {
    revalidatePath('/dashboard/crm/sales-crm/all-leads');
    if (leadId) {
        revalidatePath(`/dashboard/crm/sales-crm/all-leads/${leadId}`);
        revalidatePath(`/dashboard/crm/sales-crm/all-leads/${leadId}/edit`);
        revalidatePath(`/dashboard/crm/sales-crm/all-leads/${leadId}/activity`);
    }
}

const leadSchema = z.object({
    title: z.string().min(1, 'Lead Title is required.'),
    contactName: z.string().min(1, 'Contact Name is required.'),
    email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email('Invalid email address.').optional()),
    phone: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    company: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    website: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    country: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    state: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    city: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    industry: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    status: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    source: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    value: z.coerce.number().min(0, 'Value must be zero or greater.').optional().default(0),
    currency: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    pipelineId: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    stage: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    description: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    nextFollowUp: z.preprocess((v) => (v ? new Date(v as any) : undefined), z.date().optional().nullable()),
    leadScore: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(0).max(100).optional()),
    probabilityPct: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(0).max(100).optional()),
    expectedClose: z.preprocess((v) => (v ? new Date(v as any) : undefined), z.date().optional().nullable()),
});


export interface CrmLeadListFilters {
    /** Free-text search across title/contactName/email/company. */
    query?: string;
    /** Status (e.g. 'New', 'Qualified', 'archived'). */
    status?: string | string[];
    /** Source label. */
    source?: string;
    /** Pipeline id. */
    pipelineId?: string;
    /** Stage label or id. */
    stage?: string;
    /** Owner user id. */
    assignedTo?: string;
    /** Creation date range. */
    createdAfter?: string | Date;
    createdBefore?: string | Date;
    /** Estimated value range. */
    minValue?: number;
    maxValue?: number;
    /** When true, includes archived rows in results (default excludes them). */
    includeArchived?: boolean;
}

export interface CrmLeadKpis {
    total: number;
    newCount: number;
    qualifiedCount: number;
    wonCount: number;
    archivedCount: number;
    conversionRate: number; // 0..100
}

export async function getCrmLeads(
    page: number = 1,
    limit: number = 20,
    query?: string,
    filters: CrmLeadListFilters = {},
): Promise<{ leads: WithId<CrmLead>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { leads: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };
        const text = (query ?? filters.query ?? '').trim();
        if (text) {
            const queryRegex = { $regex: text, $options: 'i' };
            filter.$or = [
                { title: queryRegex },
                { contactName: queryRegex },
                { email: queryRegex },
                { company: queryRegex },
            ];
        }
        if (filters.status) {
            filter.status = Array.isArray(filters.status)
                ? { $in: filters.status }
                : filters.status;
        }
        if (filters.source) filter.source = filters.source;
        if (filters.pipelineId) filter.pipelineId = filters.pipelineId;
        if (filters.stage) filter.stage = filters.stage;
        if (filters.assignedTo && ObjectId.isValid(filters.assignedTo)) {
            filter.assignedTo = new ObjectId(filters.assignedTo);
        }
        if (filters.createdAfter || filters.createdBefore) {
            filter.createdAt = {} as Record<string, Date>;
            if (filters.createdAfter) (filter.createdAt as any).$gte = new Date(filters.createdAfter);
            if (filters.createdBefore) (filter.createdAt as any).$lte = new Date(filters.createdBefore);
        }
        if (typeof filters.minValue === 'number' || typeof filters.maxValue === 'number') {
            filter.value = {} as Record<string, number>;
            if (typeof filters.minValue === 'number') (filter.value as any).$gte = filters.minValue;
            if (typeof filters.maxValue === 'number') (filter.value as any).$lte = filters.maxValue;
        }
        // Default: hide archived unless caller asked for them or filtered on archived explicitly.
        const hasExplicitStatus = !!filters.status;
        if (!filters.includeArchived && !hasExplicitStatus) {
            filter.status = { $ne: 'archived' };
        }

        const skip = (page - 1) * limit;

        const [leads, total] = await Promise.all([
            db.collection<CrmLead>('crm_leads').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_leads').countDocuments(filter)
        ]);

        return {
            leads: JSON.parse(JSON.stringify(leads)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM leads:", e);
        return { leads: [], total: 0 };
    }
}

/**
 * Aggregate KPI counts for the leads dashboard strip.
 * Tenant-scoped. Falls back to zero-filled object on error.
 */
export async function getCrmLeadKpis(): Promise<CrmLeadKpis> {
    const empty: CrmLeadKpis = {
        total: 0,
        newCount: 0,
        qualifiedCount: 0,
        wonCount: 0,
        archivedCount: 0,
        conversionRate: 0,
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const buckets = await db.collection('crm_leads').aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: { $toLower: { $ifNull: ['$status', 'new'] } },
                    count: { $sum: 1 },
                },
            },
        ]).toArray();

        let total = 0;
        let newCount = 0;
        let qualifiedCount = 0;
        let wonCount = 0;
        let archivedCount = 0;

        for (const b of buckets) {
            const status = String(b._id ?? '').toLowerCase();
            const count = Number(b.count ?? 0);
            total += count;
            if (status === 'new') newCount = count;
            else if (status === 'qualified') qualifiedCount = count;
            else if (status === 'won' || status === 'converted') wonCount += count;
            else if (status === 'archived') archivedCount = count;
        }

        const denom = total - archivedCount;
        const conversionRate = denom > 0 ? Math.round((wonCount / denom) * 1000) / 10 : 0;

        return { total, newCount, qualifiedCount, wonCount, archivedCount, conversionRate };
    } catch (e) {
        console.error('[getCrmLeadKpis] failed:', e);
        return empty;
    }
}

/**
 * Load a single lead by id within the current tenant scope.
 * Returns null when not found or access denied.
 */
export async function getCrmLeadById(leadId: string): Promise<WithId<CrmLead> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!leadId || !ObjectId.isValid(leadId)) return null;

    try {
        const { db } = await connectToDatabase();
        const lead = await db.collection<CrmLead>('crm_leads').findOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(session.user._id),
        });
        if (!lead) return null;
        return JSON.parse(JSON.stringify(lead));
    } catch (e) {
        console.error('[getCrmLeadById] failed:', e);
        return null;
    }
}


export async function addCrmLead(prevState: any, formData: FormData, apiUser?: WithId<User>): Promise<{ message?: string, error?: string, leadId?: string }> {
    const session = apiUser ? { user: apiUser } : await getSession();
    if (!session?.user) return { error: "Access denied" };

    // Skip RBAC for API-key callers (apiUser path) — those have their own scope checks upstream.
    if (!apiUser) {
        const guard = await requirePermission('crm_lead', 'create');
        if (!guard.ok) return { error: guard.error };
    }

    const rawData = {
        title: formData.get('title'),
        contactName: formData.get('contactName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        website: formData.get('website'),
        country: formData.get('country'),
        state: formData.get('state'),
        city: formData.get('city'),
        industry: formData.get('industry'),
        status: formData.get('status'),
        source: formData.get('source'),
        value: formData.get('value'),
        currency: formData.get('currency'),
        pipelineId: formData.get('pipelineId'),
        stage: formData.get('stage'),
        description: formData.get('description'),
        nextFollowUp: formData.get('nextFollowUp') || undefined,
        leadScore: formData.get('leadScore'),
        probabilityPct: formData.get('probabilityPct'),
        expectedClose: formData.get('expectedClose') || undefined,
    };

    const validatedFields = leadSchema.safeParse(rawData);

    if (!validatedFields.success) {
        const flattenedErrors = validatedFields.error.flatten().fieldErrors;
        const errorString = Object.entries(flattenedErrors)
            .map(([key, value]) => `${key}: ${value.join(', ')}`)
            .join('; ');
        return { error: `Invalid data provided. Errors: ${errorString}` };
    }

    try {
        const { db } = await connectToDatabase();
        const assignedToRaw = formData.get('assignedTo');
        const newLead: Omit<CrmLead, '_id'> = ({
            userId: new ObjectId(session.user._id),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...validatedFields.data,
            value: validatedFields.data.value || 0,
            currency: validatedFields.data.currency || 'INR',
            assignedTo:
                typeof assignedToRaw === 'string' && assignedToRaw && ObjectId.isValid(assignedToRaw)
                    ? new ObjectId(assignedToRaw)
                    : undefined,
        } as any);

        const result = await db.collection('crm_leads').insertOne(newLead as CrmLead);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'lead',
            entityId: String(result.insertedId),
        });

        revalidateLeadSurfaces(result.insertedId.toString());
        return { message: 'Lead added successfully.', leadId: result.insertedId.toString() };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Edit form action. Reads `leadId` + the same field names as `addCrmLead`
 * from FormData and writes a `$set` over the matched document.
 */
export async function updateCrmLead(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; leadId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { error: guard.error };

    const leadId = String(formData.get('leadId') ?? '');
    if (!leadId || !ObjectId.isValid(leadId)) return { error: 'Invalid lead id.' };

    const rawData = {
        title: formData.get('title'),
        contactName: formData.get('contactName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        website: formData.get('website'),
        country: formData.get('country'),
        state: formData.get('state'),
        city: formData.get('city'),
        industry: formData.get('industry'),
        status: formData.get('status'),
        source: formData.get('source'),
        value: formData.get('value'),
        currency: formData.get('currency'),
        pipelineId: formData.get('pipelineId'),
        stage: formData.get('stage'),
        description: formData.get('description'),
        nextFollowUp: formData.get('nextFollowUp') || undefined,
        leadScore: formData.get('leadScore'),
        probabilityPct: formData.get('probabilityPct'),
        expectedClose: formData.get('expectedClose') || undefined,
    };

    const validated = leadSchema.safeParse(rawData);
    if (!validated.success) {
        const flat = validated.error.flatten().fieldErrors;
        const msg = Object.entries(flat).map(([k, v]) => `${k}: ${v?.join(', ')}`).join('; ');
        return { error: `Invalid data provided. Errors: ${msg}` };
    }

    try {
        const { db } = await connectToDatabase();
        const assignedToRaw = formData.get('assignedTo');
        const set: Record<string, unknown> = {
            ...validated.data,
            value: validated.data.value || 0,
            currency: validated.data.currency || 'INR',
            updatedAt: new Date(),
        };
        if (typeof assignedToRaw === 'string' && assignedToRaw && ObjectId.isValid(assignedToRaw)) {
            set.assignedTo = new ObjectId(assignedToRaw);
        }

        const before = await db.collection('crm_leads').findOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(session.user._id),
        });
        if (!before) return { error: 'Lead not found.' };

        const result = await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            { $set: set },
        );
        if (result.matchedCount === 0) return { error: 'Lead not found.' };

        const diff: Record<string, { before?: unknown; after?: unknown }> = {};
        for (const [k, after] of Object.entries(set)) {
            const beforeV = (before as Record<string, unknown>)[k];
            if (JSON.stringify(beforeV) !== JSON.stringify(after)) {
                diff[k] = { before: beforeV, after };
            }
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'lead',
            entityId: leadId,
            diff: Object.keys(diff).length ? diff : undefined,
        });

        revalidateLeadSurfaces(leadId);
        return { message: 'Lead updated successfully.', leadId };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Inline status change (used by detail-page status pill and bulk actions).
 */
export async function changeCrmLeadStatus(
    leadId: string,
    nextStatus: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!leadId || !ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };
    const status = String(nextStatus ?? '').trim();
    if (!status) return { success: false, error: 'Status is required.' };

    try {
        const { db } = await connectToDatabase();
        const before = await db.collection('crm_leads').findOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(session.user._id),
        });
        if (!before) return { success: false, error: 'Lead not found.' };

        await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            { $set: { status, updatedAt: new Date() } },
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'status_change',
            entityKind: 'lead',
            entityId: leadId,
            diff: { status: { before: (before as any).status, after: status } },
        });

        revalidateLeadSurfaces(leadId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Archive (soft-delete) a lead by setting `status: 'archived'`.
 * Preferred over hard delete for the primary destructive action.
 */
export async function archiveCrmLead(
    leadId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_lead', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!leadId || !ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            { $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Lead not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'lead',
            entityId: leadId,
        });

        revalidateLeadSurfaces(leadId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Restore an archived lead. Resets status to 'New' (caller can change
 * afterwards if needed).
 */
export async function unarchiveCrmLead(
    leadId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!leadId || !ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            {
                $set: { status: 'New', updatedAt: new Date() },
                $unset: { archivedAt: '' },
            },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Lead not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'restore',
            entityKind: 'lead',
            entityId: leadId,
        });

        revalidateLeadSurfaces(leadId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Assign one lead to an owner user. `userId` empty string unassigns.
 */
export async function assignCrmLead(
    leadId: string,
    userId: string | null,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!leadId || !ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

    try {
        const { db } = await connectToDatabase();
        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (userId && ObjectId.isValid(userId)) {
            update.assignedTo = new ObjectId(userId);
        }
        const unset = !userId ? { assignedTo: '' } : undefined;
        const op: Record<string, unknown> = { $set: update };
        if (unset) op.$unset = unset;
        const result = await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            op,
        );
        if (result.matchedCount === 0) return { success: false, error: 'Lead not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'assign',
            entityKind: 'lead',
            entityId: leadId,
            diff: { assignedTo: { after: userId || null } },
        });

        revalidateLeadSurfaces(leadId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Bulk-archive / bulk-delete / bulk-status-change / bulk-assign.
 * `op` selects the operation; `payload` carries the extra argument
 * (target status, target owner id, etc.).
 */
export async function bulkLeadAction(
    leadIds: string[],
    op: 'archive' | 'delete' | 'status' | 'assign',
    payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied' };
    const action = op === 'delete' ? 'delete' : 'edit';
    const guard = await requirePermission('crm_lead', action);
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const ids = (leadIds ?? []).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (ids.length === 0) return { success: false, processed: 0, error: 'No valid leads selected.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const baseFilter = { _id: { $in: ids }, userId };

        let processed = 0;
        if (op === 'delete') {
            const r = await db.collection('crm_leads').deleteMany(baseFilter);
            processed = r.deletedCount ?? 0;
        } else if (op === 'archive') {
            const r = await db.collection('crm_leads').updateMany(baseFilter, {
                $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() },
            });
            processed = r.modifiedCount ?? 0;
        } else if (op === 'status') {
            const status = String(payload ?? '').trim();
            if (!status) return { success: false, processed: 0, error: 'Status is required.' };
            const r = await db.collection('crm_leads').updateMany(baseFilter, {
                $set: { status, updatedAt: new Date() },
            });
            processed = r.modifiedCount ?? 0;
        } else if (op === 'assign') {
            const update: Record<string, unknown> = { updatedAt: new Date() };
            const unset: Record<string, unknown> = {};
            if (payload && ObjectId.isValid(payload)) {
                update.assignedTo = new ObjectId(payload);
            } else {
                unset.assignedTo = '';
            }
            const mongoOp: Record<string, unknown> = { $set: update };
            if (Object.keys(unset).length) mongoOp.$unset = unset;
            const r = await db.collection('crm_leads').updateMany(baseFilter, mongoOp);
            processed = r.modifiedCount ?? 0;
        }

        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: op === 'status' ? 'status_change' : op === 'assign' ? 'assign' : op,
                entityKind: 'lead',
                entityId: String(id),
                reason: payload ? `bulk:${payload}` : `bulk:${op}`,
            });
        }

        revalidateLeadSurfaces();
        return { success: true, processed };
    } catch (e: any) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

export async function deleteCrmLead(leadId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_lead', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_leads').deleteOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(session.user._id),
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Lead not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'lead',
            entityId: leadId,
        });

        revalidateLeadSurfaces();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
