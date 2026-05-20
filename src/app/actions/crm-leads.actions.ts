'use server';

/**
 * CRM Lead server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, every action delegates to the Rust BFF
 *    (`/v1/crm/leads`) via `src/lib/rust-client/crm-leads.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so existing pages keep
 * working without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmLead, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { crmLeadsApi, type CrmLeadDoc, type CrmLeadCreateInput, type CrmLeadUpdateInput } from '@/lib/rust-client/crm-leads';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { dispatchAutomations } from '@/lib/automations/dispatch';
import { sendSlackNotification } from '@/lib/integrations/slack';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

function revalidateLeadSurfaces(leadId?: string): void {
    revalidatePath('/dashboard/crm/sales-crm/all-leads');
    if (leadId) {
        revalidatePath(`/dashboard/crm/sales-crm/all-leads/${leadId}`);
        revalidatePath(`/dashboard/crm/sales-crm/all-leads/${leadId}/edit`);
        revalidatePath(`/dashboard/crm/sales-crm/all-leads/${leadId}/activity`);
    }
}

/* ─── Rust-shape → legacy TS-shape adapter ────────────────────────────── */

function splitContactName(contactName: string): { firstName: string; lastName: string } {
    const trimmed = (contactName ?? '').trim();
    if (!trimmed) return { firstName: '', lastName: '' };
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function joinContactName(firstName?: string, lastName?: string): string {
    return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function rustDocToLegacy(doc: CrmLeadDoc): WithId<CrmLead> {
    const contactName = joinContactName(doc.firstName, doc.lastName);
    const assignedToRaw = doc.assignment?.assignedTo;
    const ownerRaw = doc.ownerId;
    const out: any = {
        ...(doc as unknown as Record<string, unknown>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: (doc.identity?.userId ?? '') as unknown as ObjectId,
        title: (doc as unknown as { title?: string }).title ?? contactName,
        contactName,
        email: doc.email,
        phone: doc.phone,
        company: doc.company,
        industry: doc.industry,
        status: doc.status?.name ?? (doc.archived ? 'archived' : undefined),
        source: doc.attribution?.source,
        value: doc.estimatedValue ?? 0,
        currency: doc.currency ?? 'INR',
        leadScore: doc.leadScore,
        probabilityPct: doc.probabilityPct,
        expectedClose: doc.expectedClose ? new Date(doc.expectedClose) : undefined,
        assignedTo:
            typeof assignedToRaw === 'string' && ObjectId.isValid(assignedToRaw)
                ? (new ObjectId(assignedToRaw) as unknown as ObjectId)
                : typeof ownerRaw === 'string' && ObjectId.isValid(ownerRaw)
                  ? (new ObjectId(ownerRaw) as unknown as ObjectId)
                  : undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : doc.audit?.createdAt ? new Date(doc.audit.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : doc.audit?.updatedAt ? new Date(doc.audit.updatedAt) : undefined,
    };
    return out as WithId<CrmLead>;
}

function formDataToRustCreateInput(formData: FormData): CrmLeadCreateInput {
    const contactName = (formData.get('contactName') as string | null) ?? '';
    const { firstName, lastName } = splitContactName(contactName);
    const valueRaw = formData.get('value');
    const value =
        typeof valueRaw === 'string' && valueRaw.trim() !== ''
            ? Number(valueRaw)
            : undefined;
    const leadScoreRaw = formData.get('leadScore');
    const probabilityRaw = formData.get('probabilityPct');
    const expectedCloseRaw = formData.get('expectedClose');
    const assignedToRaw = formData.get('assignedTo');

    return {
        firstName: firstName || contactName || '',
        lastName,
        email: (formData.get('email') as string | null) || undefined,
        phone: (formData.get('phone') as string | null) || undefined,
        company: (formData.get('company') as string | null) || undefined,
        title: (formData.get('title') as string | null) || undefined,
        source: (formData.get('source') as string | null) || undefined,
        status: (formData.get('status') as string | null) || undefined,
        leadScore:
            typeof leadScoreRaw === 'string' && leadScoreRaw.trim() !== ''
                ? Number(leadScoreRaw)
                : undefined,
        assignedTo:
            typeof assignedToRaw === 'string' && assignedToRaw && ObjectId.isValid(assignedToRaw)
                ? assignedToRaw
                : undefined,
        estimatedValue: typeof value === 'number' && !isNaN(value) ? value : undefined,
        currency: (formData.get('currency') as string | null) || undefined,
        probabilityPct:
            typeof probabilityRaw === 'string' && probabilityRaw.trim() !== ''
                ? Number(probabilityRaw)
                : undefined,
        expectedClose:
            typeof expectedCloseRaw === 'string' && expectedCloseRaw.trim() !== ''
                ? expectedCloseRaw
                : undefined,
        industry: (formData.get('industry') as string | null) || undefined,
    };
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

    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) return { leads: [], total: 0 };

    if (useRustCrm()) {
        try {
            const text = (query ?? filters.query ?? '').trim();
            const items = await crmLeadsApi.list({
                page: Math.max(0, page - 1),
                limit,
                q: text || undefined,
            });
            const leads = items.map(rustDocToLegacy);
            return { leads, total: leads.length };
        } catch (e) {
            console.error('[getCrmLeads] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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

    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            // Rust KPI endpoint isn't exposed yet — pull list and aggregate
            // client-side so the rust path still produces non-empty data.
            const items = await crmLeadsApi.list({ page: 0, limit: 500 });
            let total = 0;
            let newCount = 0;
            let qualifiedCount = 0;
            let wonCount = 0;
            let archivedCount = 0;
            for (const doc of items) {
                total += 1;
                const status = String(doc.status?.name ?? '').toLowerCase();
                if (doc.archived || status === 'archived') archivedCount += 1;
                else if (status === 'new') newCount += 1;
                else if (status === 'qualified') qualifiedCount += 1;
                else if (status === 'won' || status === 'converted') wonCount += 1;
            }
            const denom = total - archivedCount;
            const conversionRate = denom > 0 ? Math.round((wonCount / denom) * 1000) / 10 : 0;
            return { total, newCount, qualifiedCount, wonCount, archivedCount, conversionRate };
        } catch (e) {
            console.error('[getCrmLeadKpis] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'other', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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
    if (!leadId) return null;

    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmLeadsApi.getById(leadId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getCrmLeadById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(leadId)) return null;

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

    if (useRustCrm()) {
        try {
            const input = formDataToRustCreateInput(formData);
            const created = await crmLeadsApi.create(input);
            const newId = created._id ?? '';

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'lead',
                entityId: String(newId),
            });

            revalidateLeadSurfaces(newId);
            // Fire automations. Best-effort — a buggy automation must
            // never break lead creation. Wire on other entities
            // incrementally (deals, tasks done; contacts/accounts/etc. TODO).
            try {
                await dispatchAutomations({
                    type: 'entity_created',
                    entityKind: 'lead',
                    entityId: String(newId),
                    tenantUserId: String(session.user._id),
                    entity: (created as unknown as Record<string, unknown>) ?? {},
                    occurredAt: Date.now(),
                });
            } catch (err) {
                console.warn('[addCrmLead] automation dispatch failed (non-fatal):', err);
            }
            // Slack — non-fatal; never breaks lead creation.
            void sendSlackNotification(
                `New lead: ${validatedFields.data.contactName || validatedFields.data.title || 'Untitled'} from ${validatedFields.data.source || 'unknown source'}`,
            ).catch((err) => console.warn('[addCrmLead] slack notify failed:', err));
            return { message: 'Lead added successfully.', leadId: newId };
        } catch (e) {
            console.error('[addCrmLead] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
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
        // Fire automations (best-effort).
        try {
            await dispatchAutomations({
                type: 'entity_created',
                entityKind: 'lead',
                entityId: result.insertedId.toString(),
                tenantUserId: String(session.user._id),
                entity: { ...(newLead as Record<string, unknown>), _id: result.insertedId },
                occurredAt: Date.now(),
            });
        } catch (err) {
            console.warn('[addCrmLead] automation dispatch failed (non-fatal):', err);
        }
        // Slack — non-fatal; never breaks lead creation.
        void sendSlackNotification(
            `New lead: ${validatedFields.data.contactName || validatedFields.data.title || 'Untitled'} from ${validatedFields.data.source || 'unknown source'}`,
        ).catch((err) => console.warn('[addCrmLead] slack notify failed:', err));
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
    if (!leadId) return { error: 'Invalid lead id.' };

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

    if (useRustCrm()) {
        try {
            const patch: CrmLeadUpdateInput = formDataToRustCreateInput(formData);
            await crmLeadsApi.update(leadId, patch);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'lead',
                entityId: leadId,
            });

            revalidateLeadSurfaces(leadId);
            return { message: 'Lead updated successfully.', leadId };
        } catch (e) {
            console.error('[updateCrmLead] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(leadId)) return { error: 'Invalid lead id.' };

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
        // Fire automations (best-effort). For each changed field, emit
        // both a generic `entity_updated` and (if it's the status field)
        // a focused `status_changed` event so authors can target either.
        try {
            const merged = { ...(before as Record<string, unknown>), ...set, _id: new ObjectId(leadId) };
            const changedFields = Object.keys(diff);
            await dispatchAutomations({
                type: 'entity_updated',
                entityKind: 'lead',
                entityId: leadId,
                tenantUserId: String(session.user._id),
                entity: merged,
                fieldName: changedFields[0],
                occurredAt: Date.now(),
            });
            if (diff.status) {
                await dispatchAutomations({
                    type: 'status_changed',
                    entityKind: 'lead',
                    entityId: leadId,
                    tenantUserId: String(session.user._id),
                    entity: merged,
                    fieldName: 'status',
                    fromValue: diff.status.before,
                    toValue: diff.status.after,
                    occurredAt: Date.now(),
                });
            }
        } catch (err) {
            console.warn('[updateCrmLead] automation dispatch failed (non-fatal):', err);
        }
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
    if (!leadId) return { success: false, error: 'Invalid lead id.' };
    const status = String(nextStatus ?? '').trim();
    if (!status) return { success: false, error: 'Status is required.' };

    if (useRustCrm()) {
        try {
            await crmLeadsApi.update(leadId, { status });

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'lead',
                entityId: leadId,
                diff: { status: { after: status } },
            });

            revalidateLeadSurfaces(leadId);
            return { success: true };
        } catch (e) {
            console.error('[changeCrmLeadStatus] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

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
    if (!leadId) return { success: false, error: 'Invalid lead id.' };

    if (useRustCrm()) {
        try {
            // DELETE /v1/crm/leads/:id is soft-delete in the Rust handler.
            await crmLeadsApi.delete(leadId);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'archive',
                entityKind: 'lead',
                entityId: leadId,
            });

            revalidateLeadSurfaces(leadId);
            return { success: true };
        } catch (e) {
            console.error('[archiveCrmLead] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

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
    if (!leadId) return { success: false, error: 'Invalid lead id.' };

    if (useRustCrm()) {
        try {
            await crmLeadsApi.update(leadId, { status: 'New' });

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'restore',
                entityKind: 'lead',
                entityId: leadId,
            });

            revalidateLeadSurfaces(leadId);
            return { success: true };
        } catch (e) {
            console.error('[unarchiveCrmLead] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

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
    if (!leadId) return { success: false, error: 'Invalid lead id.' };

    if (useRustCrm()) {
        try {
            const patch: CrmLeadUpdateInput = userId && ObjectId.isValid(userId)
                ? { assignedTo: userId }
                : { assignedTo: undefined };
            await crmLeadsApi.update(leadId, patch);

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
        } catch (e) {
            console.error('[assignCrmLead] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

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

    const validIds = (leadIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid leads selected.' };

    if (useRustCrm()) {
        try {
            let processed = 0;
            for (const id of validIds) {
                try {
                    if (op === 'delete' || op === 'archive') {
                        await crmLeadsApi.delete(id);
                        processed += 1;
                    } else if (op === 'status') {
                        const status = String(payload ?? '').trim();
                        if (!status) throw new Error('Status is required.');
                        await crmLeadsApi.update(id, { status });
                        processed += 1;
                    } else if (op === 'assign') {
                        const patch: CrmLeadUpdateInput = payload && ObjectId.isValid(payload)
                            ? { assignedTo: payload }
                            : { assignedTo: undefined };
                        await crmLeadsApi.update(id, patch);
                        processed += 1;
                    }
                } catch (innerErr) {
                    // Surface the first per-row error but keep tallying so partials are honest.
                    console.error('[bulkLeadAction] per-row rust failure:', innerErr);
                }
            }

            for (const id of validIds) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: op === 'status' ? 'status_change' : op === 'assign' ? 'assign' : op,
                    entityKind: 'lead',
                    entityId: id,
                    reason: payload ? `bulk:${payload}` : `bulk:${op}`,
                });
            }

            revalidateLeadSurfaces();
            return { success: true, processed };
        } catch (e) {
            console.error('[bulkLeadAction] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: op === 'delete' ? 'delete' : 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    const ids = validIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
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

    if (!leadId) return { success: false, error: 'Invalid lead id.' };

    if (useRustCrm()) {
        try {
            await crmLeadsApi.delete(leadId);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'lead',
                entityId: leadId,
            });

            revalidateLeadSurfaces();
            return { success: true };
        } catch (e) {
            console.error('[deleteCrmLead] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'lead', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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

/* ──────────────────────────────────────────────────────────────────────
 * Extended actions added in §1D follow-up.
 * Each action keeps the existing export-signature invariant — purely
 * additive over the shipping surface.
 * ────────────────────────────────────────────────────────────────────── */

export interface CrmLeadRelatedCounts {
    deals: number;
    tasks: number;
    tickets: number;
    quotations: number;
}

/**
 * Live counts on the right-rail of the lead detail page.
 * Each count is tenant-scoped (`userId`) and matches by:
 *  - deals:       `lineage[].kind === 'lead' && lineage[].id === leadId`
 *  - tasks:       `linkedKind === 'lead' && linkedId === leadId`
 *  - tickets:     `leadId === <objectId>`  (legacy direct FK)
 *  - quotations:  `linkedKind === 'lead' && linkedId === leadId`
 *
 * Falls back gracefully (returns 0 per bucket on aggregate failure)
 * so the right rail never blows up.
 */
export async function getCrmLeadRelatedCounts(
    leadId: string,
): Promise<CrmLeadRelatedCounts> {
    const empty: CrmLeadRelatedCounts = { deals: 0, tasks: 0, tickets: 0, quotations: 0 };
    const session = await getSession();
    if (!session?.user) return empty;
    if (!leadId || !ObjectId.isValid(leadId)) return empty;
    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const objId = new ObjectId(leadId);

        const [deals, tasks, tickets, quotations] = await Promise.all([
            db.collection('crm_deals').countDocuments({
                userId,
                lineage: { $elemMatch: { kind: 'lead', id: leadId } },
            } as Record<string, unknown>).catch(() => 0),
            db.collection('crm_tasks').countDocuments({
                userId,
                $or: [
                    { linkedKind: 'lead', linkedId: objId },
                    { linkedKind: 'lead', linkedId: leadId },
                ],
            } as Record<string, unknown>).catch(() => 0),
            db.collection('crm_tickets').countDocuments({
                userId,
                $or: [{ leadId: objId }, { leadId }],
            } as Record<string, unknown>).catch(() => 0),
            db.collection('crm_quotations').countDocuments({
                userId,
                $or: [
                    { linkedKind: 'lead', linkedId: objId },
                    { linkedKind: 'lead', linkedId: leadId },
                    { lineage: { $elemMatch: { kind: 'lead', id: leadId } } },
                ],
            } as Record<string, unknown>).catch(() => 0),
        ]);

        return { deals, tasks, tickets, quotations };
    } catch (e) {
        console.error('[getCrmLeadRelatedCounts] failed:', e);
        return empty;
    }
}

/**
 * Inline stage change (used by the Kanban DnD handler and the detail-page
 * stage pill popover). Mirrors `changeCrmLeadStatus` semantics so callers
 * can call either without caring which field they're moving.
 */
export async function updateCrmLeadStage(
    leadId: string,
    nextStage: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!leadId || !ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };
    const stage = String(nextStage ?? '').trim();

    try {
        const { db } = await connectToDatabase();
        const before = await db.collection('crm_leads').findOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(session.user._id),
        });
        if (!before) return { success: false, error: 'Lead not found.' };

        const update: Record<string, unknown> = { updatedAt: new Date() };
        const unset: Record<string, unknown> = {};
        if (stage) update.stage = stage;
        else unset.stage = '';
        const op: Record<string, unknown> = { $set: update };
        if (Object.keys(unset).length) op.$unset = unset;

        await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            op,
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'stage_change',
            entityKind: 'lead',
            entityId: leadId,
            diff: { stage: { before: (before as any).stage, after: stage || null } },
        });

        revalidateLeadSurfaces(leadId);
        return { success: true };
    } catch (e: any) {
        recordRustFallback({ entity: 'lead', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Persist the tags array on a lead. Accepts string IDs (typically tag
 * lookup ids from `<EntityMultiFormField entity="tag">`). Stores as a
 * de-duplicated string[] on `lead.tags`. Pass an empty array to clear.
 */
export async function updateCrmLeadTags(
    leadId: string,
    tags: string[],
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!leadId || !ObjectId.isValid(leadId)) return { success: false, error: 'Invalid lead id.' };

    const next = Array.from(
        new Set((tags ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)),
    );

    try {
        const { db } = await connectToDatabase();
        const before = await db.collection('crm_leads').findOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(session.user._id),
        });
        if (!before) return { success: false, error: 'Lead not found.' };

        await db.collection('crm_leads').updateOne(
            { _id: new ObjectId(leadId), userId: new ObjectId(session.user._id) },
            { $set: { tags: next, updatedAt: new Date() } },
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'lead',
            entityId: leadId,
            diff: { tags: { before: (before as any).tags ?? [], after: next } },
        });

        revalidateLeadSurfaces(leadId);
        return { success: true };
    } catch (e: any) {
        recordRustFallback({ entity: 'lead', op: 'update' });
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Duplicate finder ─────────────────────────────────────────────── */

export interface DuplicateLeadEntry {
    _id: string;
    title?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: string;
    value?: number;
    currency?: string;
    createdAt?: string;
}

export interface DuplicateGroup {
    key: 'email' | 'phone';
    value: string;
    leads: DuplicateLeadEntry[];
}

/**
 * Aggregate duplicate leads sharing the same (normalised) email or phone
 * within the current tenant. Two groups are returned per lead pair —
 * one for email matches, one for phone matches. Archived leads are
 * excluded.
 */
export async function findCrmLeadDuplicates(): Promise<DuplicateGroup[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const matchStage = {
            $match: {
                userId,
                status: { $ne: 'archived' },
            },
        } as const;

        const groupByEmail = await db
            .collection('crm_leads')
            .aggregate([
                matchStage,
                {
                    $match: {
                        email: { $exists: true, $ne: null, $not: { $eq: '' } },
                    },
                },
                {
                    $group: {
                        _id: { $toLower: { $trim: { input: '$email' } } },
                        leads: { $push: '$$ROOT' },
                        count: { $sum: 1 },
                    },
                },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 200 },
            ])
            .toArray();

        const groupByPhone = await db
            .collection('crm_leads')
            .aggregate([
                matchStage,
                {
                    $match: {
                        phone: { $exists: true, $ne: null, $not: { $eq: '' } },
                    },
                },
                {
                    $addFields: {
                        normalizedPhone: {
                            $replaceAll: {
                                input: { $replaceAll: { input: { $ifNull: ['$phone', ''] }, find: ' ', replacement: '' } },
                                find: '-',
                                replacement: '',
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: '$normalizedPhone',
                        leads: { $push: '$$ROOT' },
                        count: { $sum: 1 },
                    },
                },
                { $match: { count: { $gt: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 200 },
            ])
            .toArray();

        const toEntry = (l: any): DuplicateLeadEntry => ({
            _id: String(l._id),
            title: l.title,
            contactName: l.contactName,
            email: l.email,
            phone: l.phone,
            company: l.company,
            status: l.status,
            value: l.value,
            currency: l.currency,
            createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : undefined,
        });

        const groups: DuplicateGroup[] = [];
        for (const g of groupByEmail) {
            const value = String(g._id ?? '');
            if (!value) continue;
            groups.push({ key: 'email', value, leads: (g.leads ?? []).map(toEntry) });
        }
        for (const g of groupByPhone) {
            const value = String(g._id ?? '');
            if (!value) continue;
            groups.push({ key: 'phone', value, leads: (g.leads ?? []).map(toEntry) });
        }
        return groups;
    } catch (e) {
        console.error('[findCrmLeadDuplicates] failed:', e);
        return [];
    }
}

/* ─── Duplicate-cluster resolution ────────────────────────────────────
 *
 * Lead duplicate clusters live entirely virtually (`findCrmLeadDuplicates`
 * recomputes them on every call). The status of each cluster — pending /
 * ignored / resolved — is persisted in a per-tenant collection
 * `crm_lead_duplicate_resolutions` keyed by a stable cluster signature
 * (`<key>:<normalised-value>`). The cluster signature is the natural
 * dedupe identity: two scans that surface the same email or phone
 * collision produce the same signature.
 */

export type DuplicateClusterStatus = 'pending' | 'ignored' | 'resolved';

export interface DuplicateClusterResolution {
    signature: string;
    status: DuplicateClusterStatus;
    survivorId?: string;
    mergedIds?: string[];
    updatedAt: string;
}

const LEAD_DUP_RESOLUTIONS_COLLECTION = 'crm_lead_duplicate_resolutions';


export async function getLeadDuplicateResolutions(): Promise<DuplicateClusterResolution[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('crm_lead', 'view');
    if (!guard.ok) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(LEAD_DUP_RESOLUTIONS_COLLECTION)
            .find({ userId: new ObjectId(session.user._id) })
            .toArray();
        return docs.map((d) => ({
            signature: String((d as any).signature ?? ''),
            status: ((d as any).status as DuplicateClusterStatus) ?? 'pending',
            survivorId: (d as any).survivorId ? String((d as any).survivorId) : undefined,
            mergedIds: Array.isArray((d as any).mergedIds)
                ? ((d as any).mergedIds as unknown[]).map((x) => String(x))
                : undefined,
            updatedAt: (d as any).updatedAt
                ? new Date((d as any).updatedAt).toISOString()
                : new Date().toISOString(),
        }));
    } catch (e) {
        console.error('[getLeadDuplicateResolutions] failed:', e);
        return [];
    }
}

/**
 * Mark a duplicate cluster as ignored. Pure status flip — no lead
 * documents are touched. Idempotent.
 */
export async function ignoreLeadDuplicateCluster(
    signature: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: 'Permission denied' };
    if (!signature) return { success: false, error: 'signature required' };
    try {
        const { db } = await connectToDatabase();
        await db.collection(LEAD_DUP_RESOLUTIONS_COLLECTION).updateOne(
            { userId: new ObjectId(session.user._id), signature },
            {
                $set: {
                    userId: new ObjectId(session.user._id),
                    signature,
                    status: 'ignored',
                    updatedAt: new Date(),
                },
            },
            { upsert: true },
        );
        revalidateLeadSurfaces();
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Merge a set of duplicate leads into one survivor. Minimum viable stub:
 *  - survivor keeps its identity; its missing fields are backfilled from
 *    the other members where present
 *  - other members are archived (status='archived') and tagged with
 *    `mergedInto: <survivorId>` for traceability
 *  - the cluster signature is marked `resolved` so the duplicates scanner
 *    can hide it on the next run
 *
 * Returns the number of leads merged into the survivor.
 */
export async function mergeCrmLeads(args: {
    survivorId: string;
    mergedIds: string[];
    signature: string;
}): Promise<{ success: boolean; merged?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_lead', 'edit');
    if (!guard.ok) return { success: false, error: 'Permission denied' };

    const survivorId = String(args.survivorId ?? '').trim();
    const mergedIds = (args.mergedIds ?? [])
        .map((id) => String(id).trim())
        .filter((id) => id && id !== survivorId);
    if (!survivorId || mergedIds.length === 0) {
        return { success: false, error: 'survivor and at least one merged id required' };
    }
    if (!ObjectId.isValid(survivorId) || mergedIds.some((id) => !ObjectId.isValid(id))) {
        return { success: false, error: 'invalid lead id' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const survivorObjId = new ObjectId(survivorId);
        const mergedObjIds = mergedIds.map((id) => new ObjectId(id));

        const allDocs = await db
            .collection('crm_leads')
            .find({ userId: userObjectId, _id: { $in: [survivorObjId, ...mergedObjIds] } })
            .toArray();
        if (allDocs.length < 2) {
            return { success: false, error: 'leads not found' };
        }
        const survivor = allDocs.find((d) => String(d._id) === survivorId);
        if (!survivor) return { success: false, error: 'survivor not found' };

        // Backfill missing scalar fields on survivor from non-survivors.
        const backfillKeys = [
            'email', 'phone', 'company', 'contactName', 'title',
            'value', 'currency', 'source', 'notes',
        ] as const;
        const survivorPatch: Record<string, unknown> = {};
        for (const k of backfillKeys) {
            if (survivor[k] != null && survivor[k] !== '') continue;
            for (const d of allDocs) {
                if (String(d._id) === survivorId) continue;
                if (d[k] != null && d[k] !== '') {
                    survivorPatch[k] = d[k];
                    break;
                }
            }
        }
        if (Object.keys(survivorPatch).length > 0) {
            survivorPatch.updatedAt = new Date();
            await db.collection('crm_leads').updateOne(
                { _id: survivorObjId, userId: userObjectId },
                { $set: survivorPatch },
            );
        }

        // Archive merged docs.
        await db.collection('crm_leads').updateMany(
            { _id: { $in: mergedObjIds }, userId: userObjectId },
            {
                $set: {
                    status: 'archived',
                    mergedInto: survivorObjId,
                    mergedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        // Record resolution.
        if (args.signature) {
            await db.collection(LEAD_DUP_RESOLUTIONS_COLLECTION).updateOne(
                { userId: userObjectId, signature: args.signature },
                {
                    $set: {
                        userId: userObjectId,
                        signature: args.signature,
                        status: 'resolved',
                        survivorId: survivorObjId,
                        mergedIds: mergedObjIds,
                        updatedAt: new Date(),
                    },
                },
                { upsert: true },
            );
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'merge',
            entityKind: 'crm_lead',
            entityId: survivorId,
            reason: `Merged ${mergedIds.length} duplicate(s)`,
            diff: { mergedIds: { after: mergedIds }, signature: { after: args.signature ?? '' } },
        });

        revalidateLeadSurfaces(survivorId);
        return { success: true, merged: mergedIds.length };
    } catch (e) {
        console.error('[mergeCrmLeads] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}
