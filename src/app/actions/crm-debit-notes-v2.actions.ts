'use server';

/**
 * CRM Debit Notes — server-action wrappers around the Rust crate.
 *
 * Rust-first: every code-path delegates to `crmDebitNotesApi`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmDebitNotesApi,
    type CrmDebitNoteCreateInput,
    type CrmDebitNoteDoc,
    type CrmDebitNoteLineItem,
    type CrmDebitNoteListParams,
    type CrmDebitNoteUpdateInput,
    type DebitNoteReason,
    type DebitNoteRefundMode,
    type DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';

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

const VALID_REASONS: ReadonlySet<DebitNoteReason> = new Set<DebitNoteReason>([
    'return', 'discount', 'price_adjust', 'cancel', 'other',
]);
const VALID_REFUND_MODES: ReadonlySet<DebitNoteRefundMode> =
    new Set<DebitNoteRefundMode>(['cash', 'credit', 'replacement']);
const VALID_STATUSES: ReadonlySet<DebitNoteStatus> = new Set<DebitNoteStatus>([
    'draft', 'issued', 'refunded', 'cancelled',
]);

interface DebitNoteListResponse {
    items: CrmDebitNoteDoc[];
    hasMore: boolean;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getDebitNotes(
    filters?: CrmDebitNoteListParams,
): Promise<DebitNoteListResponse> {
    const empty: DebitNoteListResponse = { items: [], hasMore: false };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_debit_note', 'view');
    if (!guard.ok) return empty;

    try {
        const items = await crmDebitNotesApi.list(filters);
        return {
            items: Array.isArray(items) ? items : [],
            hasMore: (items?.length ?? 0) >= (filters?.limit ?? 50),
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getDebitNotes] rust call failed:', msg);
        recordRustFallback({
            entity: 'debit_note',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getDebitNoteById(id: string): Promise<CrmDebitNoteDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_debit_note', 'view');
    if (!guard.ok) return null;

    try {
        return await crmDebitNotesApi.getById(id);
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) return null;
        const { code, status, msg } = rustError(e);
        console.error('[getDebitNoteById] rust call failed:', msg);
        recordRustFallback({ entity: 'debit_note', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function parseLineItems(raw: string | null | undefined): CrmDebitNoteLineItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((it: unknown) => it && typeof it === 'object')
            .map((it: Record<string, unknown>) => {
                const qty = Number(it.qty) || 0;
                const rate = Number(it.rate) || 0;
                const total = Number(it.total);
                return {
                    ...(typeof it.itemId === 'string' && it.itemId
                        ? { itemId: it.itemId }
                        : {}),
                    ...(typeof it.description === 'string' && it.description
                        ? { description: it.description }
                        : {}),
                    qty,
                    ...(typeof it.unit === 'string' && it.unit ? { unit: it.unit } : {}),
                    rate,
                    total: Number.isFinite(total) ? total : qty * rate,
                };
            });
    } catch {
        return [];
    }
}

export async function saveDebitNote(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const debitNoteId = asString(formData.get('debitNoteId'));
    const isEditing = !!debitNoteId;

    const guard = await requirePermission(
        'crm_debit_note',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const dnNo = asString(formData.get('debitNoteNumber')) ?? '';
    const date = asString(formData.get('date'));
    const vendorId = asString(formData.get('vendor_id') ?? formData.get('vendorId'));
    const billNumber = asString(formData.get('billNumber'));
    const reasonRaw = asString(formData.get('reason')) ?? 'other';
    const reason: DebitNoteReason = VALID_REASONS.has(reasonRaw as DebitNoteReason)
        ? (reasonRaw as DebitNoteReason)
        : 'other';
    const currency = asString(formData.get('currency')) ?? 'INR';
    const items = parseLineItems(formData.get('items') as string | null);
    const refundModeRaw = asString(formData.get('refundMode')) ?? 'credit';
    const refundMode: DebitNoteRefundMode = VALID_REFUND_MODES.has(
        refundModeRaw as DebitNoteRefundMode,
    )
        ? (refundModeRaw as DebitNoteRefundMode)
        : 'credit';
    const notes = asString(formData.get('notes'));
    const reasonNotes = asString(formData.get('reasonText'));
    const statusRaw = asString(formData.get('status'));
    const status: DebitNoteStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as DebitNoteStatus)
            ? (statusRaw as DebitNoteStatus)
            : undefined;
    const totalAmountInput = asNumber(formData.get('totalAmount'));

    if (!isEditing) {
        if (!vendorId) return { error: 'Vendor id is required.' };
        if (!date) return { error: 'Date is required.' };
    }
    if (!items.length) {
        return { error: 'At least one line item is required.' };
    }

    const subTotal = items.reduce((s, it) => s + (it.total || 0), 0);
    const total =
        totalAmountInput != null && Number.isFinite(totalAmountInput)
            ? totalAmountInput
            : subTotal;

    const combinedNotes = reasonNotes
        ? notes
            ? `${notes}\n\nReason: ${reasonNotes}`
            : `Reason: ${reasonNotes}`
        : notes;

    try {
        if (isEditing) {
            const patch: CrmDebitNoteUpdateInput = {
                dnNo,
                ...(date ? { date: new Date(date).toISOString() } : {}),
                ...(vendorId ? { vendorId } : {}),
                ...(billNumber ? { linkedBillId: billNumber } : {}),
                reason,
                currency,
                items,
                totals: { subTotal, total },
                refundMode,
                ...(combinedNotes ? { notes: combinedNotes } : {}),
                ...(status ? { status } : {}),
            };
            const updated = await crmDebitNotesApi.update(debitNoteId!, patch);
            revalidatePath('/dashboard/crm/purchases/debit-notes');
            revalidatePath(`/dashboard/crm/purchases/debit-notes/${debitNoteId}`);
            return {
                message: 'Debit note updated.',
                id: updated?._id ?? debitNoteId,
            };
        }

        const payload: CrmDebitNoteCreateInput = {
            dnNo,
            date: new Date(date!).toISOString(),
            vendorId: vendorId!,
            ...(billNumber ? { linkedBillId: billNumber } : {}),
            reason,
            currency,
            items,
            totals: { subTotal, total },
            refundMode,
            ...(combinedNotes ? { notes: combinedNotes } : {}),
        };
        const created = await crmDebitNotesApi.create(payload);
        revalidatePath('/dashboard/crm/purchases/debit-notes');
        return { message: 'Debit note created.', id: String(created._id) };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveDebitNote] rust call failed:', msg);
        recordRustFallback({
            entity: 'debit_note',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save debit note: ${msg}` };
    }
}

export async function deleteDebitNote(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Debit note id is required.' };

    const guard = await requirePermission('crm_debit_note', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmDebitNotesApi.delete(id);
        revalidatePath('/dashboard/crm/purchases/debit-notes');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteDebitNote] rust call failed:', msg);
        recordRustFallback({
            entity: 'debit_note',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete debit note: ${msg}` };
    }
}
