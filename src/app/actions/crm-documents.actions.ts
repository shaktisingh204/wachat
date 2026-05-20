'use server';

/**
 * CRM HR Documents — server-action wrappers around the Rust crate.
 *
 * Rust-only path (no Mongo shadow). On Rust failure we record a fallback
 * telemetry event and return the canonical `{ message, error, id }` shape
 * consumed by `useActionState`.
 *
 * Field shape mirrors the Rust DTO (`rust/crates/crm-documents/src/dto.rs`,
 * `rename_all = "camelCase"`). Files come from SabFiles — the form uses
 * `<SabFilePickerButton>` only, never a free-text URL paste.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmDocumentsApi,
    type CrmDocumentCategory,
    type CrmDocumentCreateInput,
    type CrmDocumentDoc,
    type CrmDocumentEntityKind,
    type CrmDocumentListParams,
    type CrmDocumentListResponse,
    type CrmDocumentStatus,
    type CrmDocumentUpdateInput,
} from '@/lib/rust-client/crm-documents';

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

function asInt(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function asTags(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const tags = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return tags.length > 0 ? tags : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getDocuments(
    filters?: CrmDocumentListParams,
): Promise<CrmDocumentListResponse> {
    const empty: CrmDocumentListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_document', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmDocumentsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getDocuments] rust call failed:', msg);
        recordRustFallback({
            entity: 'document',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getDocumentById(
    id: string,
): Promise<CrmDocumentDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_document', 'view');
    if (!guard.ok) return null;

    try {
        return await crmDocumentsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getDocumentById] rust call failed:', msg);
        recordRustFallback({
            entity: 'document',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmDocumentStatus> = new Set<CrmDocumentStatus>([
    'pending',
    'verified',
    'expired',
    'rejected',
    'archived',
]);

const VALID_CATEGORIES: ReadonlySet<CrmDocumentCategory> = new Set<CrmDocumentCategory>([
    'id_proof',
    'address_proof',
    'qualification',
    'experience',
    'contract',
    'appointment',
    'resignation',
    'other',
]);

const VALID_ENTITY_KINDS: ReadonlySet<CrmDocumentEntityKind> = new Set<CrmDocumentEntityKind>([
    'employee',
    'candidate',
    'contact',
    'account',
    'vendor',
]);

function readPayload(formData: FormData): {
    payload: CrmDocumentCreateInput;
    status?: CrmDocumentStatus;
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name) {
        return {
            payload: {} as CrmDocumentCreateInput,
            error: 'Document name is required.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmDocumentStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmDocumentStatus)
            ? (statusRaw as CrmDocumentStatus)
            : undefined;

    const categoryRaw = asString(formData.get('category'));
    const category: CrmDocumentCategory | undefined =
        categoryRaw && VALID_CATEGORIES.has(categoryRaw as CrmDocumentCategory)
            ? (categoryRaw as CrmDocumentCategory)
            : undefined;

    const entityKindRaw = asString(formData.get('entityKind'));
    const entityKind: CrmDocumentEntityKind | undefined =
        entityKindRaw &&
        VALID_ENTITY_KINDS.has(entityKindRaw as CrmDocumentEntityKind)
            ? (entityKindRaw as CrmDocumentEntityKind)
            : undefined;

    const payload: CrmDocumentCreateInput = {
        name,
        description: asString(formData.get('description')),
        category,
        fileUrl: asString(formData.get('fileUrl')),
        fileSize: asInt(formData.get('fileSize')),
        mimeType: asString(formData.get('mimeType')),
        employeeId: asString(formData.get('employeeId')),
        employeeName: asString(formData.get('employeeName')),
        candidateId: asString(formData.get('candidateId')),
        entityKind,
        entityId: asString(formData.get('entityId')),
        issueDate: asString(formData.get('issueDate')),
        expiryDate: asString(formData.get('expiryDate')),
        documentNumber: asString(formData.get('documentNumber')),
        tags: asTags(formData.get('tags')),
        notes: asString(formData.get('notes')),
        isConfidential: asBool(formData.get('isConfidential')),
    };

    return { payload, status };
}

export async function saveDocument(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const documentId = asString(formData.get('documentId'));
    const isEditing = !!documentId;

    const guard = await requirePermission(
        'crm_document',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmDocumentUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
            };
            const updated = await crmDocumentsApi.update(documentId!, patch);
            revalidatePath('/dashboard/hrm/hr/documents');
            revalidatePath(`/dashboard/hrm/hr/documents/${documentId}`);
            return {
                message: 'Document updated.',
                id: updated?._id ?? documentId,
            };
        }

        const created = await crmDocumentsApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/documents');
        return {
            message: 'Document created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveDocument] rust call failed:', msg);
        recordRustFallback({
            entity: 'document',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save document: ${msg}` };
    }
}

export async function deleteDocument(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Document id is required.' };

    const guard = await requirePermission('crm_document', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmDocumentsApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/documents');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteDocument] rust call failed:', msg);
        recordRustFallback({
            entity: 'document',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete document: ${msg}` };
    }
}

/* ─── KPI ─────────────────────────────────────────────────────────────── */

export interface DocumentKpis {
    total: number;
    verified: number;
    pendingVerification: number;
    expiringIn30Days: number;
}

export async function getDocumentKpis(): Promise<DocumentKpis> {
    const empty: DocumentKpis = {
        total: 0,
        verified: 0,
        pendingVerification: 0,
        expiringIn30Days: 0,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_document', 'view');
    if (!guard.ok) return empty;

    try {
        const res = await crmDocumentsApi.list({ limit: 500 });
        const items = res.items ?? [];

        const now = Date.now();
        const thirtyDaysMs = 30 * 86_400_000;

        const verified = items.filter((d) => d.status === 'verified').length;
        const pendingVerification = items.filter((d) => d.status === 'pending').length;
        const expiringIn30Days = items.filter((d) => {
            if (!d.expiryDate) return false;
            const exp = new Date(d.expiryDate).getTime();
            return Number.isFinite(exp) && exp > now && exp - now <= thirtyDaysMs;
        }).length;

        return { total: items.length, verified, pendingVerification, expiringIn30Days };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getDocumentKpis] rust call failed:', msg);
        recordRustFallback({ entity: 'document', op: 'list', errorCode: code, status });
        return empty;
    }
}

/* ─── Bulk ────────────────────────────────────────────────────────────── */

export async function bulkUpdateDocumentStatus(
    ids: string[],
    status: CrmDocumentStatus,
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_document', 'edit');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmDocumentsApi.update(id, { status });
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/documents');
    return { succeeded, failed };
}

export async function bulkDeleteDocuments(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_document', 'delete');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmDocumentsApi.delete(id);
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/documents');
    return { succeeded, failed };
}
