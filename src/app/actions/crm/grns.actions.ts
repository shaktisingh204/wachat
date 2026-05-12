'use server';

/**
 * CRM GRN (Goods Receipt Note) server actions.
 *
 * Thin shims over the Rust BFF (`crmGrnsApi`). No direct Mongo access.
 * FormData callers (the list/edit pages) hit `saveGrnAction` /
 * `deleteGrnAction`; programmatic callers can use the typed helpers
 * (`listGrns`, `getGrn`).
 *
 * Note: `'grn'` is intentionally NOT registered as a
 * `WsCustomFieldBelongsTo` key — GRNs skip the custom-field panel
 * entirely, mirroring the procurement audit-trail design of Purchase
 * Orders.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmGrnsApi,
  type CrmGrnAttachment,
  type CrmGrnCreateInput,
  type CrmGrnDoc,
  type CrmGrnLineItem,
  type CrmGrnListParams,
  type CrmGrnUpdateInput,
} from '@/lib/rust-client/crm-grns';

const LIST_PATH = '/dashboard/crm/inventory/grn';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface GrnListResult {
  grns: CrmGrnDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listGrns(
  params: CrmGrnListParams = {},
): Promise<GrnListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const grns = await crmGrnsApi.list({ ...params, page, limit });
    return { grns, page, limit, hasMore: grns.length === limit };
  } catch (e) {
    return { grns: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getGrn(
  id: string,
): Promise<{ grn: CrmGrnDoc | null; error?: string }> {
  if (!id) return { grn: null, error: 'Missing GRN id.' };
  try {
    const grn = await crmGrnsApi.getById(id);
    return { grn };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { grn: null, error: 'GRN not found.' };
    }
    return { grn: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
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

/**
 * Normalise a raw line-item blob from the form into a wire-shaped
 * `CrmGrnLineItem`. Numeric fields default to 0 so the server-side
 * validator sees concrete numbers rather than `undefined`.
 */
function normalizeLineItem(raw: Record<string, unknown>): CrmGrnLineItem {
  const orderedQty = toNumber(raw.orderedQty) ?? 0;
  const receivedQty = toNumber(raw.receivedQty) ?? 0;
  const acceptedQty = toNumber(raw.acceptedQty) ?? 0;
  const rejectedQty = toNumber(raw.rejectedQty) ?? 0;
  const serialNosRaw = raw.serialNos;
  let serialNos: string[] | undefined;
  if (Array.isArray(serialNosRaw)) {
    serialNos = serialNosRaw
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (serialNos.length === 0) serialNos = undefined;
  } else if (typeof serialNosRaw === 'string' && serialNosRaw.trim() !== '') {
    serialNos = serialNosRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (serialNos.length === 0) serialNos = undefined;
  }
  return {
    itemId: toStringOpt(raw.itemId) ?? '',
    orderedQty,
    receivedQty,
    acceptedQty,
    rejectedQty,
    batch: toStringOpt(raw.batch),
    expiry: toStringOpt(raw.expiry),
    serialNos,
  };
}

/**
 * Parse the form's `items` hidden input — a JSON-encoded
 * `CrmGrnLineItem[]`. Returns `[]` when the blob is empty or malformed;
 * the action layer validates the resulting list before sending to Rust.
 */
function parseLineItems(formData: FormData): CrmGrnLineItem[] {
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
      .map(normalizeLineItem)
      .filter((it) => it.itemId.length > 0);
  } catch {
    return [];
  }
}

/**
 * Parse the form's `attachments` hidden input — a JSON-encoded
 * `CrmGrnAttachment[]`. Returns `undefined` when missing/empty so the
 * field is omitted on the wire (Rust treats absent and empty equally).
 */
function parseAttachments(formData: FormData): CrmGrnAttachment[] | undefined {
  const raw = formData.get('attachments');
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const list = parsed
      .filter(
        (a): a is Record<string, unknown> =>
          typeof a === 'object' && a !== null,
      )
      .map((a) => ({
        url: toStringOpt(a.url) ?? '',
        name: toStringOpt(a.name),
        mimeType: toStringOpt(a.mimeType),
        size: toNumber(a.size),
      }))
      .filter((a) => a.url.length > 0);
    return list.length > 0 ? list : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The HTML date input gives us `YYYY-MM-DD` — append a UTC marker so
 * the Rust RFC3339 parser accepts it.
 */
function toIso(d?: string): string | undefined {
  if (!d) return undefined;
  if (d.includes('T')) return d;
  return `${d}T00:00:00Z`;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. GRNs have no custom-field bag.
 */
export async function saveGrnAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const grnNo = pickString(formData, 'grnNo');
  const date = pickString(formData, 'date');
  const vendorId = pickString(formData, 'vendorId');
  const warehouseId = pickString(formData, 'warehouseId');
  const poId = pickString(formData, 'poId');
  const inspectorId = pickString(formData, 'inspectorId');
  const status = pickString(formData, 'status');
  const items = parseLineItems(formData);
  const attachments = parseAttachments(formData);

  if (!id) {
    // Required-on-create gate. PATCH is partial — the Rust handler does
    // its own validation when any of these are sent.
    if (!grnNo) return { error: 'GRN number is required.' };
    if (!date) return { error: 'Receipt date is required.' };
    if (!vendorId) return { error: 'Vendor is required.' };
    if (!warehouseId) return { error: 'Warehouse is required.' };
    if (items.length === 0) {
      return { error: 'At least one line item is required.' };
    }
  }

  try {
    let result: CrmGrnDoc;
    if (id) {
      const patch: CrmGrnUpdateInput = {};
      const isoDate = toIso(date);
      if (isoDate) patch.date = isoDate;
      if (vendorId) patch.vendorId = vendorId;
      if (warehouseId) patch.warehouseId = warehouseId;
      if (inspectorId) patch.inspectorId = inspectorId;
      if (items.length > 0) patch.items = items;
      if (attachments) patch.attachments = attachments;
      if (status) patch.status = status;
      result = await crmGrnsApi.update(id, patch);
    } else {
      const draft: CrmGrnCreateInput = {
        grnNo: grnNo as string,
        date: toIso(date) as string,
        vendorId: vendorId as string,
        warehouseId: warehouseId as string,
        items,
        poId,
        inspectorId,
        attachments,
      };
      result = await crmGrnsApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'GRN updated.' : 'GRN created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a GRN. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteGrnAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing GRN id.' };
  try {
    await crmGrnsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'GRN not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createGrn(input: CrmGrnCreateInput) {
  return crmGrnsApi.create(input);
}

export async function updateGrn(id: string, patch: CrmGrnUpdateInput) {
  return crmGrnsApi.update(id, patch);
}

export async function deleteGrn(id: string) {
  return crmGrnsApi.delete(id);
}
