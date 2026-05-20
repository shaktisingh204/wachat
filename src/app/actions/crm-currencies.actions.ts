'use server';

/**
 * CRM Currencies — server actions.
 *
 * Thin wrapper over the Rust `/v1/crm/currencies` BFF (via `crmCurrenciesApi`).
 * Mirrors the shape of `crm-accounting.actions.ts` — RBAC-guarded, audit-logged,
 * revalidates the settings page on every mutation, and records Rust failures
 * through `recordRustFallback` (no legacy Mongo fallback for this entity).
 *
 * `saveCurrency` is a single useActionState-compatible action that handles
 * both create AND update — it inspects `_id` on the FormData to branch.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/index.ts';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmCurrenciesApi,
    type CrmCurrencyDoc,
    type CrmCurrencyCreateInput,
    type CrmCurrencyUpdateInput,
    type CrmCurrencyDisplayFormat,
    type CrmCurrencyStatus,
} from '@/lib/rust-client/crm-currencies';

const REVALIDATE_PATH = '/dashboard/crm/settings/currencies';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    return s.length === 0 ? undefined : s;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    const s = asString(v);
    if (s == null) return false;
    return s === 'true' || s === 'on' || s === '1' || s === 'yes';
}

/* ─── Read ────────────────────────────────────────────────────────────── */

/**
 * Returns every currency for the current tenant. Backed by the Rust BFF;
 * limit defaults to 200 which is well above ISO 4217's ~180 active codes.
 */
export async function getCurrencies(): Promise<CrmCurrencyDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_currency', 'view');
    if (!guard.ok) return [];

    try {
        const res = await crmCurrenciesApi.list({ limit: 200 });
        return JSON.parse(JSON.stringify(res.items));
    } catch (e) {
        console.error('[getCurrencies] rust path failed:', e);
        recordRustFallback({
            entity: 'currency',
            op: 'list',
            errorCode: e instanceof RustApiError ? e.code : undefined,
            status: e instanceof RustApiError ? e.status : undefined,
        });
        return [];
    }
}

export async function getCurrencyById(id: string): Promise<CrmCurrencyDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_currency', 'view');
    if (!guard.ok) return null;

    try {
        const doc = await crmCurrenciesApi.getById(id);
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getCurrencyById] rust path failed:', e);
        recordRustFallback({
            entity: 'currency',
            op: 'get',
            errorCode: e instanceof RustApiError ? e.code : undefined,
            status: e instanceof RustApiError ? e.status : undefined,
        });
        return null;
    }
}

/* ─── Write ───────────────────────────────────────────────────────────── */

/**
 * Combined create/update action — drives the inline-create + edit dialogs.
 *
 * - If `_id` exists on the FormData and is a valid ObjectId, the call is
 *   routed through `crmCurrenciesApi.update(id, patch)`.
 * - Otherwise it falls through to `crmCurrenciesApi.create(input)`.
 *
 * Form fields (all strings — coerced inside this action):
 *   - `_id`              optional, when editing
 *   - `code`             ISO 4217 3-letter (server uppercases)
 *   - `name`             required
 *   - `symbol`           optional, e.g. "$"
 *   - `decimalPlaces`    number, default 2 server-side
 *   - `exchangeRate`     number vs base, default 1
 *   - `isBase`           "true"/"on" → boolean
 *   - `displayFormat`    "prefix" | "suffix"
 *   - `thousandSeparator`
 *   - `decimalSeparator`
 *   - `isActive`         "true"/"on" → boolean
 *   - `status`           "active" | "archived" (edit only)
 */
export async function saveCurrency(
    _prevState: { message?: string; error?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const rawId = asString(formData.get('_id'));
    const isEditing = !!rawId && ObjectId.isValid(rawId);

    const guard = await requirePermission('crm_currency', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const code = asString(formData.get('code'));
    const name = asString(formData.get('name'));

    if (!isEditing) {
        if (!code) return { error: 'Currency code is required.' };
        if (!name) return { error: 'Currency name is required.' };
        if (!/^[A-Za-z]{3}$/.test(code)) {
            return { error: 'Currency code must be a 3-letter ISO 4217 alpha code.' };
        }
    } else if (code && !/^[A-Za-z]{3}$/.test(code)) {
        return { error: 'Currency code must be a 3-letter ISO 4217 alpha code.' };
    }

    const symbol = asString(formData.get('symbol'));
    const decimalPlaces = asNumber(formData.get('decimalPlaces'));
    const exchangeRate = asNumber(formData.get('exchangeRate'));
    const isBase = asBool(formData.get('isBase'));
    const rawDisplayFormat = asString(formData.get('displayFormat'));
    const displayFormat: CrmCurrencyDisplayFormat | undefined =
        rawDisplayFormat === 'prefix' || rawDisplayFormat === 'suffix'
            ? rawDisplayFormat
            : undefined;
    const thousandSeparator = asString(formData.get('thousandSeparator'));
    const decimalSeparator = asString(formData.get('decimalSeparator'));
    const isActiveRaw = asString(formData.get('isActive'));
    const isActive = isActiveRaw == null ? undefined : isActiveRaw === 'true' || isActiveRaw === 'on' || isActiveRaw === '1';
    const rawStatus = asString(formData.get('status'));
    const status: CrmCurrencyStatus | undefined =
        rawStatus === 'active' || rawStatus === 'archived' ? rawStatus : undefined;

    try {
        let savedId: string;
        let savedName: string | undefined = name;

        if (isEditing) {
            const patch: CrmCurrencyUpdateInput = {};
            if (code) patch.code = code.toUpperCase();
            if (name) patch.name = name;
            if (symbol !== undefined) patch.symbol = symbol;
            if (decimalPlaces !== undefined) patch.decimalPlaces = decimalPlaces;
            if (exchangeRate !== undefined) patch.exchangeRate = exchangeRate;
            // isBase is always present on a form submit (checkbox); send it
            // explicitly so toggling OFF works.
            patch.isBase = isBase;
            if (displayFormat) patch.displayFormat = displayFormat;
            if (thousandSeparator !== undefined) patch.thousandSeparator = thousandSeparator;
            if (decimalSeparator !== undefined) patch.decimalSeparator = decimalSeparator;
            if (isActive !== undefined) patch.isActive = isActive;
            if (status) patch.status = status;

            const updated = await crmCurrenciesApi.update(rawId!, patch);
            savedId = updated._id;
            savedName = updated.name ?? savedName;
        } else {
            const input: CrmCurrencyCreateInput = {
                code: code!.toUpperCase(),
                name: name!,
                symbol,
                decimalPlaces,
                exchangeRate,
                isBase,
                displayFormat,
                thousandSeparator,
                decimalSeparator,
                isActive: isActive ?? true,
            };
            const created = await crmCurrenciesApi.create(input);
            savedId = created.id;
            savedName = created.entity?.name ?? savedName;
        }

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'currency',
            entityId: savedId,
            reason: savedName,
        });

        revalidatePath(REVALIDATE_PATH);
        return {
            message: isEditing
                ? 'Currency updated successfully.'
                : 'Currency created successfully.',
        };
    } catch (e) {
        console.error('[saveCurrency] rust path failed:', e);
        recordRustFallback({
            entity: 'currency',
            op: isEditing ? 'update' : 'create',
            errorCode: e instanceof RustApiError ? e.code : undefined,
            status: e instanceof RustApiError ? e.status : undefined,
        });
        if (e instanceof RustApiError) {
            return { error: e.message || 'Failed to save currency.' };
        }
        return { error: getErrorMessage(e) };
    }
}

/* ─── Bulk actions ────────────────────────────────────────────────────── */

type BulkResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Bulk delete currencies. Only non-base currencies should be passed — the
 * server does NOT enforce this for flexibility, but the UI enforces it by
 * filtering selected IDs before calling.
 */
export async function bulkDeleteCurrencies(ids: string[]): Promise<BulkResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied' };
    if (ids.length === 0) return { ok: false, error: 'No currencies selected.' };

    const guard = await requirePermission('crm_currency', 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };

    let count = 0;
    for (const id of ids) {
        try {
            await crmCurrenciesApi.delete(id);
            count++;
        } catch (e) {
            console.error(`[bulkDeleteCurrencies] failed for ${id}:`, e);
            recordRustFallback({
                entity: 'currency',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, count };
}

/**
 * Bulk set currency status (active | archived).
 */
export async function bulkSetCurrencyStatus(
    ids: string[],
    status: CrmCurrencyStatus,
): Promise<BulkResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied' };
    if (ids.length === 0) return { ok: false, error: 'No currencies selected.' };

    const guard = await requirePermission('crm_currency', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    let count = 0;
    for (const id of ids) {
        try {
            await crmCurrenciesApi.update(id, { status });
            count++;
        } catch (e) {
            console.error(`[bulkSetCurrencyStatus] failed for ${id}:`, e);
            recordRustFallback({
                entity: 'currency',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, count };
}

export async function deleteCurrency(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!id) return { success: false, error: 'Invalid currency ID' };

    const guard = await requirePermission('crm_currency', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        await crmCurrenciesApi.delete(id);
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'currency',
            entityId: id,
        });
        revalidatePath(REVALIDATE_PATH);
        return { success: true };
    } catch (e) {
        console.error('[deleteCurrency] rust path failed:', e);
        recordRustFallback({
            entity: 'currency',
            op: 'delete',
            errorCode: e instanceof RustApiError ? e.code : undefined,
            status: e instanceof RustApiError ? e.status : undefined,
        });
        if (e instanceof RustApiError) {
            return { success: false, error: e.message || 'Failed to delete currency.' };
        }
        return { success: false, error: getErrorMessage(e) };
    }
}
