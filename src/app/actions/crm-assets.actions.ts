'use server';

/**
 * CRM HR Assets — server-action wrappers around the Rust crate.
 *
 * Backed by `crmAssetsApi` from `@/lib/rust-client/crm-assets`. No legacy
 * Mongo shadow: on Rust failure we record a fallback telemetry event and
 * return either an empty list or `{ error }`.
 *
 * Audit entries are written best-effort after successful mutations.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmAssetsApi,
    type CrmAssetCategory,
    type CrmAssetCondition,
    type CrmAssetCreateInput,
    type CrmAssetDoc,
    type CrmAssetListParams,
    type CrmAssetListResponse,
    type CrmAssetStatus,
    type CrmAssetUpdateInput,
} from '@/lib/rust-client/crm-assets';

const BASE_PATH = '/dashboard/hrm/hr/assets';
const RBAC_KEY = 'crm_asset';
const ENTITY_KIND = 'asset';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asTags(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const tags = s.split(',').map((t) => t.trim()).filter(Boolean);
    return tags.length > 0 ? tags : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) return { code: e.code, status: e.status, msg: e.message };
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmAssetStatus> = new Set<CrmAssetStatus>([
    'available',
    'assigned',
    'in_repair',
    'retired',
    'archived',
]);

const VALID_CONDITIONS: ReadonlySet<CrmAssetCondition> = new Set<CrmAssetCondition>([
    'new',
    'good',
    'fair',
    'poor',
    'damaged',
]);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getAssets(
    filters?: CrmAssetListParams,
): Promise<CrmAssetListResponse> {
    const empty: CrmAssetListResponse = { items: [], page: 1, limit: 50, hasMore: false };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return empty;

    try {
        return await crmAssetsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getAssets] rust call failed:', msg);
        recordRustFallback({ entity: ENTITY_KIND, op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getAssetById(id: string): Promise<CrmAssetDoc | null> {
    const session = await getSession();
    if (!session?.user || !id) return null;

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return null;

    try {
        return await crmAssetsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getAssetById] rust call failed:', msg);
        recordRustFallback({ entity: ENTITY_KIND, op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmAssetCreateInput;
    error?: string;
} {
    const assetTag = asString(formData.get('assetTag'));
    const name = asString(formData.get('name'));
    if (!assetTag) return { payload: {} as CrmAssetCreateInput, error: 'Asset tag is required.' };
    if (!name) return { payload: {} as CrmAssetCreateInput, error: 'Name is required.' };

    const statusRaw = asString(formData.get('status'));
    const status: CrmAssetStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmAssetStatus)
            ? (statusRaw as CrmAssetStatus)
            : undefined;

    const conditionRaw = asString(formData.get('condition'));
    const condition: CrmAssetCondition | undefined =
        conditionRaw && VALID_CONDITIONS.has(conditionRaw as CrmAssetCondition)
            ? (conditionRaw as CrmAssetCondition)
            : undefined;

    const payload: CrmAssetCreateInput = {
        assetTag,
        name,
        category: asString(formData.get('category')) as CrmAssetCategory | undefined,
        brand: asString(formData.get('brand')),
        model: asString(formData.get('model')),
        serialNumber: asString(formData.get('serialNumber')),
        purchaseDate: asString(formData.get('purchaseDate')),
        purchasePrice: asNumber(formData.get('purchasePrice')),
        currency: asString(formData.get('currency')),
        warrantyExpiry: asString(formData.get('warrantyExpiry')),
        location: asString(formData.get('location')),
        branchId: asString(formData.get('branchId')),
        currentAssigneeId: asString(formData.get('currentAssigneeId')),
        currentAssigneeName: asString(formData.get('currentAssigneeName')),
        notes: asString(formData.get('notes')),
        tags: asTags(formData.get('tags')),
        ...(condition ? { condition } : {}),
        ...(status ? { status } : {}),
    };

    return { payload };
}

export async function saveAsset(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const assetId = asString(formData.get('assetId'));
    const isEditing = !!assetId;

    const guard = await requirePermission(RBAC_KEY, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmAssetUpdateInput = payload;
            const updated = await crmAssetsApi.update(assetId!, patch);
            const id = updated?._id ?? assetId!;
            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'update',
                entityKind: ENTITY_KIND,
                entityId: id,
                reason: `Asset ${payload.assetTag} updated`,
            });
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${assetId}`);
            return { message: 'Asset updated.', id };
        }

        const created = await crmAssetsApi.create(payload);
        void writeAuditEntry({
            tenantUserId: session.user._id as string,
            action: 'create',
            entityKind: ENTITY_KIND,
            entityId: created.id,
            reason: `Asset ${payload.assetTag} created`,
        });
        revalidatePath(BASE_PATH);
        return { message: 'Asset created.', id: created.id };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveAsset] rust call failed:', msg);
        recordRustFallback({
            entity: ENTITY_KIND,
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save asset: ${msg}` };
    }
}

export async function deleteAsset(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Asset id is required.' };

    const guard = await requirePermission(RBAC_KEY, 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmAssetsApi.delete(id);
        if (result?.deleted) {
            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'delete',
                entityKind: ENTITY_KIND,
                entityId: id,
            });
        }
        revalidatePath(BASE_PATH);
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteAsset] rust call failed:', msg);
        recordRustFallback({ entity: ENTITY_KIND, op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete asset: ${msg}` };
    }
}
