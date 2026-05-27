'use server';

/**
 * CRM Vendor Bids — server-action wrappers around the Rust crate.
 *
 * Rust-first: every code-path delegates to `crmVendorBidsApi`. On Rust
 * failure we record a fallback telemetry event and surface the error.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmVendorBidsApi,
    type CrmVendorBidAttachment,
    type CrmVendorBidCreateInput,
    type CrmVendorBidDoc,
    type CrmVendorBidLineItem,
    type CrmVendorBidListParams,
    type CrmVendorBidStatus,
    type CrmVendorBidUpdateInput,
} from '@/lib/rust-client/crm-vendor-bids';

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

const VALID_STATUSES: ReadonlySet<CrmVendorBidStatus> =
    new Set<CrmVendorBidStatus>([
        'submitted',
        'shortlisted',
        'awarded',
        'rejected',
        'withdrawn',
    ]);

interface VendorBidListResponse {
    items: CrmVendorBidDoc[];
    hasMore: boolean;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getVendorBids(
    filters?: CrmVendorBidListParams,
): Promise<VendorBidListResponse> {
    const empty: VendorBidListResponse = { items: [], hasMore: false };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_vendor_bid', 'view');
    if (!guard.ok) return empty;

    try {
        const items = await crmVendorBidsApi.list(filters);
        return {
            items: Array.isArray(items) ? items : [],
            hasMore: (items?.length ?? 0) >= (filters?.limit ?? 50),
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getVendorBids] rust call failed:', msg);
        recordRustFallback({ entity: 'vendor_bid', op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getVendorBidById(id: string): Promise<CrmVendorBidDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_vendor_bid', 'view');
    if (!guard.ok) return null;

    try {
        return await crmVendorBidsApi.getById(id);
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) return null;
        const { code, status, msg } = rustError(e);
        console.error('[getVendorBidById] rust call failed:', msg);
        recordRustFallback({ entity: 'vendor_bid', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function parseLineItems(raw: string | null | undefined): CrmVendorBidLineItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((it: unknown) => it && typeof it === 'object')
            .map((it: Record<string, unknown>) => ({
                ...(typeof it.itemId === 'string' && it.itemId ? { itemId: it.itemId } : {}),
                qty: Number(it.qty) || 0,
                rate: Number(it.rate) || 0,
                ...(it.leadTimeDays != null
                    ? { leadTimeDays: Number(it.leadTimeDays) || 0 }
                    : {}),
                ...(typeof it.notes === 'string' && it.notes ? { notes: it.notes } : {}),
            }));
    } catch {
        return [];
    }
}

function parseAttachments(raw: string | null | undefined): CrmVendorBidAttachment[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((a: unknown) => {
                if (typeof a === 'string') return { fileId: a };
                if (a && typeof a === 'object') {
                    const r = a as Record<string, unknown>;
                    return {
                        ...(typeof r.fileId === 'string' ? { fileId: r.fileId } : {}),
                        ...(typeof r.name === 'string' ? { name: r.name } : {}),
                        ...(typeof r.url === 'string' ? { url: r.url } : {}),
                        ...(typeof r.mime === 'string' ? { mime: r.mime } : {}),
                        ...(typeof r.size === 'number' ? { size: r.size } : {}),
                    };
                }
                return null;
            })
            .filter((a): a is CrmVendorBidAttachment => !!a);
    } catch {
        return [];
    }
}

export async function saveVendorBid(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const bidId = asString(formData.get('bidId'));
    const isEditing = !!bidId;

    const guard = await requirePermission(
        'crm_vendor_bid',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const rfqId = asString(formData.get('rfqId'));
    const vendorId = asString(formData.get('vendorId'));
    const currency = asString(formData.get('currency')) || 'INR';
    const items = parseLineItems(formData.get('items') as string | null);
    const vendorName = asString(formData.get('vendorName'));
    const terms = asString(formData.get('terms'));
    const notes = asString(formData.get('notes'));
    const attachments = parseAttachments(formData.get('attachments') as string | null);
    const validUntil = asString(formData.get('validUntil'));
    const bidAmount = asNumber(formData.get('bidAmount'));
    const statusRaw = asString(formData.get('status'));
    const status: CrmVendorBidStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmVendorBidStatus)
            ? (statusRaw as CrmVendorBidStatus)
            : undefined;

    if (!isEditing) {
        if (!rfqId) return { error: 'RFQ id is required.' };
        if (!vendorId) return { error: 'Vendor id is required.' };
    }
    if (!items.length) {
        return { error: 'At least one line item is required.' };
    }

    const subTotal = items.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
    const total = bidAmount && Number.isFinite(bidAmount) ? bidAmount : subTotal;

    const combinedTerms = notes
        ? terms
            ? `${terms}\n\nNotes:\n${notes}\n${validUntil ? `Valid until: ${validUntil}` : ''}`
            : `Notes:\n${notes}\n${validUntil ? `Valid until: ${validUntil}` : ''}`
        : validUntil
            ? `${terms ? terms + '\n\n' : ''}Valid until: ${validUntil}`
            : terms;

    try {
        if (isEditing) {
            const patch: CrmVendorBidUpdateInput = {
                items,
                totals: { subTotal, total },
                currency,
                ...(vendorName ? { vendorName } : {}),
                ...(combinedTerms ? { terms: combinedTerms } : {}),
                ...(attachments.length ? { attachments } : {}),
                ...(status ? { status } : {}),
            };
            const updated = await crmVendorBidsApi.update(bidId!, patch);
            revalidatePath('/dashboard/crm/purchases/vendor-bids');
            revalidatePath(`/dashboard/crm/purchases/vendor-bids/${bidId}`);
            return { message: 'Vendor bid updated.', id: updated?._id ?? bidId };
        }

        const payload: CrmVendorBidCreateInput = {
            rfqId: rfqId!,
            vendorId: vendorId!,
            items,
            totals: { subTotal, total },
            currency,
            ...(vendorName ? { vendorName } : {}),
            ...(combinedTerms ? { terms: combinedTerms } : {}),
            ...(attachments.length ? { attachments } : {}),
        };
        const created = await crmVendorBidsApi.create(payload);
        revalidatePath('/dashboard/crm/purchases/vendor-bids');
        return { message: 'Vendor bid created.', id: String(created._id) };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveVendorBid] rust call failed:', msg);
        recordRustFallback({
            entity: 'vendor_bid',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save vendor bid: ${msg}` };
    }
}

export async function deleteVendorBid(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Bid id is required.' };

    const guard = await requirePermission('crm_vendor_bid', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmVendorBidsApi.delete(id);
        revalidatePath('/dashboard/crm/purchases/vendor-bids');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteVendorBid] rust call failed:', msg);
        recordRustFallback({ entity: 'vendor_bid', op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete bid: ${msg}` };
    }
}
