'use server';

/**
 * CRM RFQs — server-action wrappers around the Rust crate.
 *
 * Rust-first: every code-path delegates to `crmRfqsApi`. On Rust
 * failure we record a fallback telemetry event and surface the error.
 *
 * Field shape mirrors the Rust DTO which serialises with
 * `rename_all = "camelCase"`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmRfqsApi,
    type CrmRfqAttachment,
    type CrmRfqCreateInput,
    type CrmRfqDoc,
    type CrmRfqLineItem,
    type CrmRfqListParams,
    type CrmRfqStatus,
    type CrmRfqUpdateInput,
} from '@/lib/rust-client/crm-rfqs';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmRfqStatus> = new Set<CrmRfqStatus>([
    'draft',
    'open',
    'closed',
    'awarded',
    'cancelled',
]);

interface RfqListResponse {
    items: CrmRfqDoc[];
    hasMore: boolean;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getRfqs(
    filters?: CrmRfqListParams,
): Promise<RfqListResponse> {
    const empty: RfqListResponse = { items: [], hasMore: false };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_rfq', 'view');
    if (!guard.ok) return empty;

    try {
        const items = await crmRfqsApi.list(filters);
        return {
            items: Array.isArray(items) ? items : [],
            hasMore: (items?.length ?? 0) >= (filters?.limit ?? 50),
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getRfqs] rust call failed:', msg);
        recordRustFallback({ entity: 'rfq', op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getRfqById(id: string): Promise<CrmRfqDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_rfq', 'view');
    if (!guard.ok) return null;

    try {
        return await crmRfqsApi.getById(id);
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) return null;
        const { code, status, msg } = rustError(e);
        console.error('[getRfqById] rust call failed:', msg);
        recordRustFallback({ entity: 'rfq', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function parseLineItems(raw: string | null | undefined): CrmRfqLineItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((it: unknown) =>
                it && typeof (it as { itemId?: unknown }).itemId === 'string'
                && !!(it as { itemId?: string }).itemId,
            )
            .map((it: Record<string, unknown>) => ({
                itemId: String(it.itemId),
                qty: Number(it.qty) || 0,
                ...(typeof it.description === 'string' && it.description
                    ? { description: it.description }
                    : {}),
                ...(typeof it.unit === 'string' && it.unit ? { unit: it.unit } : {}),
                ...(typeof it.specs === 'string' && it.specs ? { specs: it.specs } : {}),
            }));
    } catch {
        return [];
    }
}

function parseStringArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v: unknown): v is string => typeof v === 'string' && !!v);
    } catch {
        return [];
    }
}

function parseAttachments(raw: string | null | undefined): CrmRfqAttachment[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((a: unknown) => {
                if (typeof a === 'string') return { fileId: a };
                if (a && typeof a === 'object') {
                    const r = a as Record<string, unknown>;
                    if (typeof r.fileId === 'string' && r.fileId) {
                        return {
                            fileId: r.fileId,
                            ...(typeof r.name === 'string' ? { name: r.name } : {}),
                            ...(typeof r.url === 'string' ? { url: r.url } : {}),
                            ...(typeof r.mime === 'string' ? { mime: r.mime } : {}),
                            ...(typeof r.size === 'number' ? { size: r.size } : {}),
                        } as CrmRfqAttachment;
                    }
                }
                return null;
            })
            .filter((a): a is CrmRfqAttachment => !!a);
    } catch {
        return [];
    }
}

export async function saveRfq(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const rfqId = asString(formData.get('rfqId'));
    const isEditing = !!rfqId;

    const guard = await requirePermission('crm_rfq', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const title = asString(formData.get('title'));
    if (!title) return { error: 'Title is required.' };

    const items = parseLineItems(formData.get('items') as string | null);
    if (!items.length) return { error: 'At least one line item is required.' };

    const vendorsInvited = parseStringArray(formData.get('vendorsInvited') as string | null);
    const attachments = parseAttachments(formData.get('attachments') as string | null);
    const terms = asString(formData.get('terms'));
    const notes = asString(formData.get('notes'));
    const deadline = asString(formData.get('deadline'));
    const requiredBy = asString(formData.get('requiredBy'));
    const statusRaw = asString(formData.get('status'));
    const status: CrmRfqStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmRfqStatus)
            ? (statusRaw as CrmRfqStatus)
            : undefined;

    const basePayload: CrmRfqCreateInput = {
        title,
        items,
        ...(vendorsInvited.length ? { vendorsInvited } : {}),
        ...(attachments.length ? { attachments } : {}),
        ...(terms ? { terms } : {}),
        ...(deadline ? { deadline: new Date(deadline).toISOString() } : {}),
        ...(requiredBy ? { requiredBy: new Date(requiredBy).toISOString() } : {}),
    };

    // Notes ride through `terms` if no separate column exists on the wire.
    // (Rust DTO doesn't have a dedicated notes column on RFQs.)
    const payloadWithNotes: CrmRfqCreateInput = notes
        ? { ...basePayload, terms: terms ? `${terms}\n\nNotes:\n${notes}` : `Notes:\n${notes}` }
        : basePayload;

    try {
        if (isEditing) {
            const patch: CrmRfqUpdateInput = {
                ...payloadWithNotes,
                ...(status ? { status } : {}),
            };
            const updated = await crmRfqsApi.update(rfqId!, patch);
            revalidatePath('/dashboard/crm/purchases/rfqs');
            revalidatePath(`/dashboard/crm/purchases/rfqs/${rfqId}`);
            return { message: 'RFQ updated.', id: updated?._id ?? rfqId };
        }

        const created = await crmRfqsApi.create(payloadWithNotes);
        revalidatePath('/dashboard/crm/purchases/rfqs');
        return { message: 'RFQ created.', id: String(created._id) };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveRfq] rust call failed:', msg);
        recordRustFallback({
            entity: 'rfq',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save RFQ: ${msg}` };
    }
}

export async function deleteRfq(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'RFQ id is required.' };

    const guard = await requirePermission('crm_rfq', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmRfqsApi.delete(id);
        revalidatePath('/dashboard/crm/purchases/rfqs');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteRfq] rust call failed:', msg);
        recordRustFallback({ entity: 'rfq', op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete RFQ: ${msg}` };
    }
}
