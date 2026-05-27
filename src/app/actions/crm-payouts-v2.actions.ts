'use server';

/**
 * CRM Payouts — server-action wrappers around the Rust crate.
 *
 * Rust-first: every code-path delegates to `crmPayoutsApi`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmPayoutsApi,
    type CrmPayoutCreateInput,
    type CrmPayoutDoc,
    type CrmPayoutListParams,
    type CrmPayoutMode,
    type CrmPayoutStatus,
    type CrmPayoutUpdateInput,
} from '@/lib/rust-client/crm-payouts';

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

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_MODES: ReadonlySet<CrmPayoutMode> = new Set<CrmPayoutMode>([
    'cash', 'cheque', 'upi', 'neft', 'rtgs', 'imps', 'card', 'wallet',
]);
const VALID_STATUSES: ReadonlySet<CrmPayoutStatus> = new Set<CrmPayoutStatus>([
    'sent', 'cleared', 'failed',
]);

interface PayoutListResponse {
    items: CrmPayoutDoc[];
    hasMore: boolean;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getPayouts(
    filters?: CrmPayoutListParams,
): Promise<PayoutListResponse> {
    const empty: PayoutListResponse = { items: [], hasMore: false };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_payout', 'view');
    if (!guard.ok) return empty;

    try {
        const items = await crmPayoutsApi.list(filters);
        return {
            items: Array.isArray(items) ? items : [],
            hasMore: (items?.length ?? 0) >= (filters?.limit ?? 50),
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getPayouts] rust call failed:', msg);
        recordRustFallback({ entity: 'payout', op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getPayoutById(id: string): Promise<CrmPayoutDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_payout', 'view');
    if (!guard.ok) return null;

    try {
        return await crmPayoutsApi.getById(id);
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) return null;
        const { code, status, msg } = rustError(e);
        console.error('[getPayoutById] rust call failed:', msg);
        recordRustFallback({ entity: 'payout', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function savePayout(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const payoutId = asString(formData.get('payoutId'));
    const isEditing = !!payoutId;

    const guard = await requirePermission('crm_payout', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const vendorId = asString(formData.get('vendor_id') ?? formData.get('vendorId'));
    const amount = asNumber(formData.get('amount'));
    const currency = asString(formData.get('currency')) ?? 'INR';
    const paymentMethodRaw = asString(formData.get('paymentMethod'));
    const mode: CrmPayoutMode =
        paymentMethodRaw && VALID_MODES.has(paymentMethodRaw as CrmPayoutMode)
            ? (paymentMethodRaw as CrmPayoutMode)
            : 'neft';
    const bankAccountId = asString(formData.get('paymentAccountId')) ?? '';
    const paidAt = asString(formData.get('paidAt'));
    const referenceNumber = asString(formData.get('referenceNumber'));
    const notes = asString(formData.get('notes'));
    const payoutNumber = asString(formData.get('payoutNumber'));
    const statusRaw = asString(formData.get('status'));
    const status: CrmPayoutStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmPayoutStatus)
            ? (statusRaw as CrmPayoutStatus)
            : undefined;

    if (!isEditing) {
        if (!vendorId) return { error: 'Vendor id is required.' };
        if (amount == null || amount <= 0) {
            return { error: 'Amount must be greater than 0.' };
        }
        if (!paidAt) return { error: 'Payment date is required.' };
    }

    try {
        if (isEditing) {
            const patch: CrmPayoutUpdateInput = {
                ...(payoutNumber ? { paymentNo: payoutNumber } : {}),
                ...(paidAt ? { date: new Date(paidAt).toISOString() } : {}),
                ...(vendorId ? { vendorId } : {}),
                ...(paymentMethodRaw ? { mode } : {}),
                ...(bankAccountId ? { bankAccountId } : {}),
                ...(referenceNumber ? { reference: referenceNumber } : {}),
                ...(amount != null ? { amount } : {}),
                ...(currency ? { currency } : {}),
                ...(notes ? { notes } : {}),
                ...(status ? { status } : {}),
            };
            const updated = await crmPayoutsApi.update(payoutId!, patch);
            revalidatePath('/dashboard/crm/purchases/payouts');
            revalidatePath(`/dashboard/crm/purchases/payouts/${payoutId}`);
            return { message: 'Payout updated.', id: updated?._id ?? payoutId };
        }

        const payload: CrmPayoutCreateInput = {
            paymentNo: payoutNumber ?? '',
            date: new Date(paidAt!).toISOString(),
            vendorId: vendorId!,
            mode,
            bankAccountId,
            amount: amount!,
            currency,
            ...(referenceNumber ? { reference: referenceNumber } : {}),
            ...(notes ? { notes } : {}),
        };
        const created = await crmPayoutsApi.create(payload);
        revalidatePath('/dashboard/crm/purchases/payouts');
        return { message: 'Payout created.', id: String(created._id) };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[savePayout] rust call failed:', msg);
        recordRustFallback({
            entity: 'payout',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save payout: ${msg}` };
    }
}

export async function deletePayout(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Payout id is required.' };

    const guard = await requirePermission('crm_payout', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmPayoutsApi.delete(id);
        revalidatePath('/dashboard/crm/purchases/payouts');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deletePayout] rust call failed:', msg);
        recordRustFallback({ entity: 'payout', op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete payout: ${msg}` };
    }
}

export async function updatePayoutStatus(
    id: string,
    status: CrmPayoutStatus,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Payout id is required.' };

    const guard = await requirePermission('crm_payout', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!VALID_STATUSES.has(status)) {
        return { success: false, error: 'Invalid status.' };
    }

    try {
        await crmPayoutsApi.update(id, { status });
        revalidatePath('/dashboard/crm/purchases/payouts');
        revalidatePath(`/dashboard/crm/purchases/payouts/${id}`);
        return { success: true };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[updatePayoutStatus] rust call failed:', msg);
        recordRustFallback({
            entity: 'payout',
            op: 'update',
            errorCode: code,
            status: httpStatus,
        });
        return { success: false, error: `Failed to update status: ${msg}` };
    }
}

