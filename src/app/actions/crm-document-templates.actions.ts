'use server';

/**
 * CRM HR Document Templates — legacy Mongo-backed server actions.
 *
 * There is no Rust crate yet for `document_templates`, so all reads and
 * writes go straight to the `crm_document_templates` Mongo collection.
 * Auth + RBAC + audit follow the standard CRM pattern.
 *
 * Fields:
 *   name, category, body (markdown), variables (string[]),
 *   templateFileUrl (SabFile), isActive, status
 *
 * Soft-delete is performed by flipping `status` to `archived`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
    crmDocumentTemplatesApi,
    type CrmDocumentTemplateDoc as RustCrmDocumentTemplateDoc,
} from '@/lib/rust-client/crm-document-templates';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const ENTITY_KIND = 'document_template';

/**
 * Coerces a Rust-shaped template doc (variables as objects) into the
 * legacy TS shape (variables as bare strings). Existing callers expect
 * `variables: string[]`; the rust path projects each `{ name, ... }` to
 * its `name`.
 */
function rustToLegacy(
    doc: RustCrmDocumentTemplateDoc,
): CrmDocumentTemplateDoc {
    return {
        _id: String(doc._id),
        userId: doc.userId,
        name: doc.name,
        category: doc.category,
        body: doc.body,
        variables: Array.isArray(doc.variables)
            ? doc.variables
                  .map((v) => (typeof v === 'string' ? v : v?.name))
                  .filter((v): v is string => typeof v === 'string' && v.length > 0)
            : [],
        templateFileUrl: doc.templateFileUrl,
        isActive: doc.isActive === true,
        status: (doc.status ?? 'draft') as CrmDocumentTemplateStatus,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmDocumentTemplateStatus =
    | 'draft'
    | 'active'
    | 'archived';

interface CrmDocumentTemplateDoc {
    _id: string;
    userId?: string;
    name: string;
    category?: string;
    body?: string;
    variables?: string[];
    templateFileUrl?: string;
    isActive?: boolean;
    status: CrmDocumentTemplateStatus;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmDocumentTemplateListParams {
    q?: string;
    status?: CrmDocumentTemplateStatus | 'all';
    category?: string;
    limit?: number;
}

interface CrmDocumentTemplateListResponse {
    items: CrmDocumentTemplateDoc[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function asVariables(v: FormDataEntryValue | null): string[] {
    const s = asString(v);
    if (!s) return [];
    return s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
}

const VALID_STATUSES: ReadonlySet<CrmDocumentTemplateStatus> = new Set<CrmDocumentTemplateStatus>([
    'draft',
    'active',
    'archived',
]);

function normaliseStatus(v: string | undefined): CrmDocumentTemplateStatus {
    if (v && VALID_STATUSES.has(v as CrmDocumentTemplateStatus)) {
        return v as CrmDocumentTemplateStatus;
    }
    return 'draft';
}

function toDoc(raw: WithId<Document>): CrmDocumentTemplateDoc {
    return {
        _id: String(raw._id),
        userId: raw.userId ? String(raw.userId) : undefined,
        name: String(raw.name ?? ''),
        category: raw.category ? String(raw.category) : undefined,
        body: raw.body ? String(raw.body) : undefined,
        variables: Array.isArray(raw.variables)
            ? (raw.variables as unknown[]).map(String)
            : [],
        templateFileUrl: raw.templateFileUrl
            ? String(raw.templateFileUrl)
            : undefined,
        isActive: raw.isActive === true,
        status: normaliseStatus(raw.status as string | undefined),
        createdAt: raw.createdAt instanceof Date
            ? raw.createdAt.toISOString()
            : (raw.createdAt as string | undefined),
        updatedAt: raw.updatedAt instanceof Date
            ? raw.updatedAt.toISOString()
            : (raw.updatedAt as string | undefined),
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getDocumentTemplates(
    filters?: CrmDocumentTemplateListParams,
): Promise<CrmDocumentTemplateListResponse> {
    const empty: CrmDocumentTemplateListResponse = { items: [] };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_document_template', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmDocumentTemplatesApi.list({
                q: filters?.q,
                status: filters?.status,
                category: filters?.category,
                limit: filters?.limit,
            });
            return {
                items: (res.items ?? []).map(rustToLegacy),
            };
        } catch (e) {
            console.error(
                '[getDocumentTemplates] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: ENTITY_KIND,
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id as string),
        };

        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }
        if (filters?.category) {
            filter.category = filters.category;
        }
        if (filters?.q) {
            filter.name = { $regex: filters.q, $options: 'i' };
        }

        const limit = Math.min(filters?.limit ?? 100, 500);
        const rows = await db
            .collection('crm_document_templates')
            .find(filter)
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit)
            .toArray();

        return { items: rows.map(toDoc) };
    } catch (e) {
        console.error('[getDocumentTemplates] failed:', e);
        return empty;
    }
}

export async function getDocumentTemplateById(
    id: string,
): Promise<CrmDocumentTemplateDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_document_template', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmDocumentTemplatesApi.getById(id);
            return rustToLegacy(doc);
        } catch (e) {
            console.error(
                '[getDocumentTemplateById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: ENTITY_KIND,
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const row = await db.collection('crm_document_templates').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return row ? toDoc(row) : null;
    } catch (e) {
        console.error('[getDocumentTemplateById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveDocumentTemplate(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const templateId = asString(formData.get('templateId'));
    const isEditing = !!templateId;

    const guard = await requirePermission(
        'crm_document_template',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Template name is required.' };

    const status = normaliseStatus(asString(formData.get('status')));
    const isActiveFlag = asBool(formData.get('isActive'));

    const payload = {
        name,
        category: asString(formData.get('category')) ?? null,
        body: asString(formData.get('body')) ?? null,
        variables: asVariables(formData.get('variables')),
        templateFileUrl: asString(formData.get('templateFileUrl')) ?? null,
        isActive: isActiveFlag,
        status,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        if (isEditing) {
            if (!ObjectId.isValid(templateId!)) {
                return { error: 'Invalid template id.' };
            }
            const filter = { _id: new ObjectId(templateId), userId };
            const before = await db
                .collection('crm_document_templates')
                .findOne(filter);
            if (!before) return { error: 'Template not found.' };

            await db
                .collection('crm_document_templates')
                .updateOne(filter, { $set: payload });

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'document_template',
                entityId: templateId!,
            });

            revalidatePath('/dashboard/hrm/hr/document-templates');
            revalidatePath(`/dashboard/hrm/hr/document-templates/${templateId}`);
            return { message: 'Template updated.', id: templateId };
        }

        const insertDoc = {
            ...payload,
            userId,
            createdAt: new Date(),
        };
        const result = await db
            .collection('crm_document_templates')
            .insertOne(insertDoc);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'document_template',
            entityId: result.insertedId.toString(),
        });

        revalidatePath('/dashboard/hrm/hr/document-templates');
        return {
            message: 'Template created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveDocumentTemplate] failed:', msg);
        return { error: `Failed to save template: ${msg}` };
    }
}

export async function deleteDocumentTemplate(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid template id.' };
    }

    const guard = await requirePermission('crm_document_template', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const filter = {
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        };

        const result = await db
            .collection('crm_document_templates')
            .updateOne(filter, {
                $set: {
                    status: 'archived' as CrmDocumentTemplateStatus,
                    isActive: false,
                    updatedAt: new Date(),
                },
            });

        if (result.matchedCount === 0) {
            return { success: false, error: 'Template not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'document_template',
            entityId: id,
        });

        revalidatePath('/dashboard/hrm/hr/document-templates');
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteDocumentTemplate] failed:', msg);
        return { success: false, error: `Failed to delete template: ${msg}` };
    }
}

/* ─── Bulk & KPIs (§1D Deep template) ────────────────────────────────── */

interface CrmDocumentTemplateKpis {
    total: number;
    byCategory: Record<string, number>;
    lastGeneratedAt?: string;
}

/**
 * Aggregate top-line KPI counts for the document-templates list page.
 *
 * Falls back to zeros on failure so the KPI strip degrades gracefully.
 */
export async function getDocumentTemplateKpis(): Promise<CrmDocumentTemplateKpis> {
    const empty: CrmDocumentTemplateKpis = { total: 0, byCategory: {} };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_document_template', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const rows = await db
            .collection('crm_document_templates')
            .find({
                userId: new ObjectId(session.user._id as string),
                status: { $ne: 'archived' },
            })
            .project({ category: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .limit(1000)
            .toArray();

        const byCategory: Record<string, number> = {};
        let lastGeneratedAt: string | undefined;
        for (const r of rows) {
            const cat = String((r as { category?: unknown }).category ?? 'other');
            byCategory[cat] = (byCategory[cat] ?? 0) + 1;
            const updated = (r as { updatedAt?: unknown }).updatedAt;
            if (!lastGeneratedAt && updated) {
                lastGeneratedAt =
                    updated instanceof Date
                        ? updated.toISOString()
                        : String(updated);
            }
        }
        return { total: rows.length, byCategory, lastGeneratedAt };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[getDocumentTemplateKpis] failed:', msg);
        return empty;
    }
}

type CrmDocumentTemplateBulkOp = 'delete' | 'archive' | 'publish';

interface CrmDocumentTemplateBulkResult {
    success: boolean;
    affected: number;
    error?: string;
}

/**
 * Apply a bulk operation across a set of template ids in the same tenant.
 *
 * `delete`/`archive` — soft-archive (status → archived, isActive false)
 * `publish`         — flip status → "active" + isActive true
 */
export async function bulkDocumentTemplateAction(
    ids: string[],
    op: CrmDocumentTemplateBulkOp,
): Promise<CrmDocumentTemplateBulkResult> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, affected: 0, error: 'Access denied.' };
    }
    if (!Array.isArray(ids) || ids.length === 0) {
        return { success: true, affected: 0 };
    }

    const guard = await requirePermission(
        'crm_document_template',
        op === 'publish' ? 'edit' : 'delete',
    );
    if (!guard.ok) return { success: false, affected: 0, error: guard.error };

    const objectIds = ids
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
    if (objectIds.length === 0) return { success: true, affected: 0 };

    try {
        const { db } = await connectToDatabase();
        const filter = {
            _id: { $in: objectIds },
            userId: new ObjectId(session.user._id as string),
        };

        const update: Record<string, unknown> =
            op === 'publish'
                ? {
                      status: 'active' as CrmDocumentTemplateStatus,
                      isActive: true,
                      updatedAt: new Date(),
                  }
                : {
                      status: 'archived' as CrmDocumentTemplateStatus,
                      isActive: false,
                      updatedAt: new Date(),
                  };

        const res = await db
            .collection('crm_document_templates')
            .updateMany(filter, { $set: update });

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: op,
            entityKind: 'document_template',
            entityId: ids.join(','),
        });

        revalidatePath('/dashboard/hrm/hr/document-templates');
        revalidatePath('/dashboard/crm/hr/document-templates');
        return { success: true, affected: res.modifiedCount };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[bulkDocumentTemplateAction] failed:', msg);
        return { success: false, affected: 0, error: msg };
    }
}
