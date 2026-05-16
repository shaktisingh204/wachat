'use server';

/**
 * CRM HR Notices — server-action wrappers around the Rust crate
 * (`/v1/crm/notices`).
 *
 * This entity is NEW (no legacy Mongo `crm_notices` collection), so every
 * code-path delegates to `crmNoticesApi`. On Rust failure we record a
 * fallback telemetry event and return `{ error }` — there is no Mongo
 * shadow read to fall back to.
 *
 * Field shape mirrors the Rust DTO (`rust/crates/crm-notices/src/dto.rs`)
 * which serialises with `rename_all = "camelCase"`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmNoticesApi,
    type CrmNoticeCreateInput,
    type CrmNoticeDoc,
    type CrmNoticeListParams,
    type CrmNoticeListResponse,
    type CrmNoticeStatus,
    type CrmNoticeCategory,
    type CrmNoticeSeverity,
    type CrmNoticeAudience,
    type CrmNoticeUpdateInput,
} from '@/lib/rust-client/crm-notices';

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

function asStringList(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const items = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return items.length > 0 ? items : undefined;
}

/**
 * Read all values for a repeated field name (e.g. `attachments`). The form
 * submits one hidden input per attachment URL, so `formData.getAll(...)`
 * returns the array directly.
 */
function asUrlList(formData: FormData, name: string): string[] | undefined {
    const raw = formData.getAll(name);
    if (!raw || raw.length === 0) return undefined;
    const urls = raw
        .map((v) => String(v).trim())
        .filter((s) => s.length > 0);
    return urls.length > 0 ? urls : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Validation sets ────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmNoticeStatus> = new Set<CrmNoticeStatus>([
    'draft',
    'issued',
    'acknowledged',
    'superseded',
    'archived',
]);

const VALID_CATEGORIES: ReadonlySet<CrmNoticeCategory> =
    new Set<CrmNoticeCategory>([
        'general',
        'safety',
        'compliance',
        'closure',
        'meeting',
        'emergency',
    ]);

const VALID_SEVERITIES: ReadonlySet<CrmNoticeSeverity> =
    new Set<CrmNoticeSeverity>(['info', 'warning', 'critical']);

const VALID_AUDIENCES: ReadonlySet<CrmNoticeAudience> =
    new Set<CrmNoticeAudience>([
        'all',
        'department',
        'team',
        'role',
        'individual',
    ]);

/* ─── Reads ──────────────────────────────────────────────────────────── */

/**
 * Fetch the list of notices for the active session.
 *
 * Filters map straight onto the Rust list endpoint. On any failure we
 * return an empty list response so the page can render its empty state
 * rather than crash.
 */
export async function getNotices(
    filters?: CrmNoticeListParams,
): Promise<CrmNoticeListResponse> {
    const empty: CrmNoticeListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_notice', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmNoticesApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getNotices] rust call failed:', msg);
        recordRustFallback({
            entity: 'notice',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

/**
 * Fetch a single notice document by id.
 */
export async function getNoticeById(id: string): Promise<CrmNoticeDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_notice', 'view');
    if (!guard.ok) return null;

    try {
        return await crmNoticesApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getNoticeById] rust call failed:', msg);
        recordRustFallback({
            entity: 'notice',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmNoticeCreateInput;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title) {
        return {
            payload: {} as CrmNoticeCreateInput,
            error: 'Title is required.',
        };
    }

    const body = asString(formData.get('body'));
    if (!body) {
        return {
            payload: {} as CrmNoticeCreateInput,
            error: 'Body is required.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmNoticeStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmNoticeStatus)
            ? (statusRaw as CrmNoticeStatus)
            : undefined;

    const categoryRaw = asString(formData.get('category'));
    const category: CrmNoticeCategory | undefined =
        categoryRaw && VALID_CATEGORIES.has(categoryRaw as CrmNoticeCategory)
            ? (categoryRaw as CrmNoticeCategory)
            : undefined;

    const severityRaw = asString(formData.get('severity'));
    const severity: CrmNoticeSeverity | undefined =
        severityRaw && VALID_SEVERITIES.has(severityRaw as CrmNoticeSeverity)
            ? (severityRaw as CrmNoticeSeverity)
            : undefined;

    const audienceRaw = asString(formData.get('issuedTo'));
    const issuedTo: CrmNoticeAudience | undefined =
        audienceRaw && VALID_AUDIENCES.has(audienceRaw as CrmNoticeAudience)
            ? (audienceRaw as CrmNoticeAudience)
            : undefined;

    const payload: CrmNoticeCreateInput = {
        // `noticeNumber` is optional — the Rust crate auto-generates one
        // (e.g. `NTC-2026-0001`) when omitted.
        noticeNumber: asString(formData.get('noticeNumber')),
        title,
        body,
        referenceNumber: asString(formData.get('referenceNumber')),
        recipientIds: asStringList(formData.get('recipientIds')),
        effectiveFrom: asString(formData.get('effectiveFrom')),
        effectiveUntil: asString(formData.get('effectiveUntil')),
        requireAcknowledgement: asBool(formData.get('requireAcknowledgement')),
        attachments: asUrlList(formData, 'attachments'),
        notes: asString(formData.get('notes')),
        ...(category ? { category } : {}),
        ...(severity ? { severity } : {}),
        ...(issuedTo ? { issuedTo } : {}),
        ...(status ? { status } : {}),
    };

    return { payload };
}

/**
 * Create or update a notice. If `noticeId` is supplied (hidden form
 * field) we PATCH, otherwise we POST. Returns the canonical
 * `{ message, error, id }` shape consumed by `useActionState`.
 */
export async function saveNotice(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const noticeId = asString(formData.get('noticeId'));
    const isEditing = !!noticeId;

    const guard = await requirePermission(
        'crm_notice',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmNoticeUpdateInput = payload;
            const updated = await crmNoticesApi.update(noticeId!, patch);
            revalidatePath('/dashboard/hrm/hr/notices');
            revalidatePath(`/dashboard/hrm/hr/notices/${noticeId}`);
            return {
                message: 'Notice updated.',
                id: updated?._id ?? noticeId,
            };
        }

        const created = await crmNoticesApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/notices');
        return {
            message: 'Notice created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveNotice] rust call failed:', msg);
        recordRustFallback({
            entity: 'notice',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save notice: ${msg}` };
    }
}

/**
 * Soft-delete a notice. We prefer the explicit DELETE endpoint exposed
 * by the Rust crate; the crate handles the "soft-delete vs hard-delete"
 * decision server-side based on its own configuration.
 */
export async function deleteNotice(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Notice id is required.' };

    const guard = await requirePermission('crm_notice', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmNoticesApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/notices');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteNotice] rust call failed:', msg);
        recordRustFallback({
            entity: 'notice',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete notice: ${msg}` };
    }
}
