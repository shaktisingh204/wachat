'use server';

/**
 * CRM Vendor Bid server actions.
 *
 * Thin shims over the Rust BFF (`crmVendorBidsApi`). No direct Mongo
 * access. FormData callers (the list/edit pages) hit
 * `saveVendorBidAction` / `deleteVendorBidAction`; programmatic
 * callers can use the typed helpers (`listVendorBids`, `getVendorBid`).
 *
 * Note: `'vendorBid'` is intentionally NOT registered as a
 * `WsCustomFieldBelongsTo` key — Vendor Bids skip the custom-field
 * panel entirely, mirroring the procurement audit-trail design used by
 * Purchase Orders.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmVendorBidsApi,
  type CrmVendorBidCreateInput,
  type CrmVendorBidDoc,
  type CrmVendorBidLineItem,
  type CrmVendorBidListParams,
  type CrmVendorBidStatus,
  type CrmVendorBidTotals,
  type CrmVendorBidUpdateInput,
} from '@/lib/rust-client/crm-vendor-bids';
import { writeAuditEntry } from '@/lib/audit-log';
import { getSession } from '@/app/actions/user.actions';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';

const LIST_PATH = '/dashboard/crm/purchases/vendor-bids';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface VendorBidListResult {
  bids: CrmVendorBidDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listVendorBids(
  params: CrmVendorBidListParams = {},
): Promise<VendorBidListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  const session = await getSession();
  if (!session?.user) {
    return { bids: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_vendor_bid', 'view');
  if (!guard.ok) {
    return { bids: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const bids = await crmVendorBidsApi.list({ ...params, page, limit });
    return { bids, page, limit, hasMore: bids.length === limit };
  } catch (e) {
    console.error('[listVendorBids] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'vendor_bid', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { bids: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getVendorBid(
  id: string,
): Promise<{ bid: CrmVendorBidDoc | null; error?: string }> {
  if (!id) return { bid: null, error: 'Missing vendor bid id.' };
  const session = await getSession();
  if (!session?.user) {
    return { bid: null, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_vendor_bid', 'view');
  if (!guard.ok) {
    return { bid: null, error: guard.error };
  }
  try {
    const bid = await crmVendorBidsApi.getById(id);
    return { bid };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { bid: null, error: 'Vendor bid not found.' };
    }
    console.error('[getVendorBid] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'vendor_bid', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { bid: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse the form's `items` hidden input — a JSON-encoded
 * `CrmVendorBidLineItem[]`. Returns `[]` when the blob is empty or
 * malformed; the action layer validates the resulting list before
 * sending to Rust.
 */
function parseLineItems(formData: FormData): CrmVendorBidLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is Record<string, unknown> =>
          typeof it === 'object' && it !== null,
      )
      .map((it) => normalizeLineItem(it));
  } catch {
    return [];
  }
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toStringOpt(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function normalizeLineItem(raw: Record<string, unknown>): CrmVendorBidLineItem {
  return {
    itemId: toStringOpt(raw.itemId),
    qty: toNumber(raw.qty) ?? 0,
    rate: toNumber(raw.rate) ?? 0,
    leadTimeDays: toNumber(raw.leadTimeDays),
    notes: toStringOpt(raw.notes),
  };
}

/**
 * Compute document totals from the line items. The handler can
 * recompute later; we send a stable snapshot so the saved doc reflects
 * what the user saw at submit time. Per-line `total` is `qty * rate`
 * (vendor bids don't carry per-line tax/discount in the wire shape —
 * pricing nuance lives in the `terms` blob).
 */
function computeTotals(items: CrmVendorBidLineItem[]): CrmVendorBidTotals {
  const subTotal = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0),
    0,
  );
  return { subTotal, total: subTotal };
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Vendor Bids have no custom-field bag.
 */
export async function saveVendorBidAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_vendor_bid', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  const rfqId = pickString(formData, 'rfqId');
  const vendorId = pickString(formData, 'vendorId');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const items = parseLineItems(formData);

  if (!id) {
    // Required-on-create gate.
    if (!rfqId) return { error: 'RFQ id is required.' };
    if (!vendorId) return { error: 'Vendor is required.' };
    if (items.length === 0) {
      return { error: 'At least one line item is required.' };
    }
  }

  const totals = computeTotals(items);

  try {
    let result: CrmVendorBidDoc;
    if (id) {
      const patch: CrmVendorBidUpdateInput = {};
      if (currency) patch.currency = currency;
      if (items.length > 0) {
        patch.items = items;
        patch.totals = totals;
      }
      const terms = pickString(formData, 'terms');
      if (terms) patch.terms = terms;
      const vendorName = pickString(formData, 'vendorName');
      if (vendorName) patch.vendorName = vendorName;
      const status = pickString(formData, 'status');
      if (status) patch.status = status;
      result = await crmVendorBidsApi.update(id, patch);
    } else {
      const draft: CrmVendorBidCreateInput = {
        rfqId: rfqId as string,
        vendorId: vendorId as string,
        currency,
        items,
        totals,
        terms: pickString(formData, 'terms'),
        vendorName: pickString(formData, 'vendorName'),
      };
      result = await crmVendorBidsApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'vendorBid',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Vendor bid updated.' : 'Vendor bid created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveVendorBidAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'vendor_bid', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a vendor bid. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteVendorBidAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing vendor bid id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_vendor_bid', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmVendorBidsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'vendorBid',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Vendor bid not found.' };
    }
    console.error('[deleteVendorBidAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'vendor_bid', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmVendorBidsApi.x(...)`.

export async function createVendorBid(input: CrmVendorBidCreateInput) {
  return crmVendorBidsApi.create(input);
}

export async function updateVendorBid(id: string, patch: CrmVendorBidUpdateInput) {
  return crmVendorBidsApi.update(id, patch);
}

export async function deleteVendorBid(id: string) {
  return crmVendorBidsApi.delete(id);
}

/* ─── Bulk + status helpers ───────────────────────────────────── */

async function recordAudit(
  action: 'update' | 'delete' | 'archive' | 'create' | 'status_change',
  entityId: string,
): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.user?._id) return;
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action,
      entityKind: 'vendorBid',
      entityId,
    });
  } catch (e) {
    console.error('[vendor-bids audit] non-fatal:', e);
  }
}

function trackFallback(op: 'update' | 'delete', e: unknown): void {
  recordRustFallback({
    entity: 'vendorBid',
    op,
    errorCode: e instanceof RustApiError ? e.code : undefined,
    status: e instanceof RustApiError ? e.status : undefined,
  });
}

export async function updateVendorBidStatus(
  id: string,
  status: CrmVendorBidStatus | string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing vendor bid id.' };
  const guard = await requirePermission('crm_vendor_bid', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmVendorBidsApi.update(id, { status });
    await recordAudit('status_change', id);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    console.error('[updateVendorBidStatus] rust path failed; falling back:', e);
    trackFallback('update', e);
    return { success: false, error: rustErr(e) };
  }
}

export async function archiveVendorBidAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing vendor bid id.' };
  const guard = await requirePermission('crm_vendor_bid', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    // Vendor Bid Rust DTO uses `withdrawn` as the soft-archive terminal.
    await crmVendorBidsApi.update(id, { status: 'withdrawn' });
    await recordAudit('archive', id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    console.error('[archiveVendorBidAction] rust path failed; falling back:', e);
    trackFallback('update', e);
    return { success: false, error: rustErr(e) };
  }
}

export interface BulkResult {
  success: boolean;
  processed: number;
  error?: string;
}

async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<void>,
): Promise<BulkResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No vendor bid ids supplied.' };
  }
  let processed = 0;
  let lastErr: string | undefined;
  for (const id of ids) {
    try {
      await fn(id);
      processed += 1;
    } catch (e) {
      lastErr = rustErr(e);
    }
  }
  revalidatePath(LIST_PATH);
  if (processed === 0) {
    return { success: false, processed, error: lastErr ?? 'Bulk operation failed.' };
  }
  return { success: true, processed, error: lastErr };
}

export async function bulkDeleteVendorBids(ids: string[]): Promise<BulkResult> {
  const guard = await requirePermission('crm_vendor_bid', 'delete');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  return runBulk(ids, async (id) => {
    await crmVendorBidsApi.delete(id);
    await recordAudit('delete', id);
  });
}

export async function bulkArchiveVendorBids(ids: string[]): Promise<BulkResult> {
  const guard = await requirePermission('crm_vendor_bid', 'edit');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  return runBulk(ids, async (id) => {
    await crmVendorBidsApi.update(id, { status: 'withdrawn' });
    await recordAudit('archive', id);
  });
}

export async function bulkChangeVendorBidStatus(
  ids: string[],
  status: CrmVendorBidStatus | string,
): Promise<BulkResult> {
  const guard = await requirePermission('crm_vendor_bid', 'edit');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  return runBulk(ids, async (id) => {
    await crmVendorBidsApi.update(id, { status });
    await recordAudit('status_change', id);
  });
}
