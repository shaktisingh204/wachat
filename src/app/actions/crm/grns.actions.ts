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
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
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

interface GrnListResult {
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
  const session = await getSession();
  if (!session?.user) {
    return { grns: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_grn', 'view');
  if (!guard.ok) return { grns: [], page, limit, hasMore: false, error: guard.error };
  try {
    const grns = await crmGrnsApi.list({ ...params, page, limit });
    return { grns, page, limit, hasMore: grns.length === limit };
  } catch (e) {
    console.error('[listGrns] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'grn', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { grns: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getGrn(
  id: string,
): Promise<{ grn: CrmGrnDoc | null; error?: string }> {
  if (!id) return { grn: null, error: 'Missing GRN id.' };
  const session = await getSession();
  if (!session?.user) return { grn: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_grn', 'view');
  if (!guard.ok) return { grn: null, error: guard.error };
  try {
    const grn = await crmGrnsApi.getById(id);
    return { grn };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { grn: null, error: 'GRN not found.' };
    }
    console.error('[getGrn] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'grn', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_grn', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

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

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'grn',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'GRN updated.' : 'GRN created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveGrnAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'grn', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_grn', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmGrnsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'grn',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'GRN not found.' };
    }
    console.error('[deleteGrnAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'grn', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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

/* ─── KPIs ────────────────────────────────────────────────────── */

interface GrnKpis {
  pendingQcCount: number;
  acceptedCount: number;
  partiallyAcceptedCount: number;
  rejectedCount: number;
  /** Number of GRNs created in the current calendar month. */
  mtdCount: number;
  /** Sum of received-quantity × unit cost across the sampled window. */
  totalReceivedValue: number;
  /** ISO currency code dominant across the sampled window. */
  totalReceivedCurrency: string;
}

const EMPTY_GRN_KPIS: GrnKpis = {
  pendingQcCount: 0,
  acceptedCount: 0,
  partiallyAcceptedCount: 0,
  rejectedCount: 0,
  mtdCount: 0,
  totalReceivedValue: 0,
  totalReceivedCurrency: 'INR',
};

/**
 * Derive GRN KPIs from a wide page. "Pending QC" maps to `draft` (the
 * pre-inspection state); "Accepted" maps to `posted` (fully accepted);
 * "Partially accepted" maps to `inspected` rows where some lines were
 * rejected; "Rejected" maps to `rejected`.
 */
export async function getGrnKpis(): Promise<GrnKpis> {
  try {
    const rows = await crmGrnsApi.list({ page: 1, limit: 100 });
    if (!Array.isArray(rows) || rows.length === 0) return EMPTY_GRN_KPIS;
    let pendingQcCount = 0;
    let acceptedCount = 0;
    let partiallyAcceptedCount = 0;
    let rejectedCount = 0;
    let mtdCount = 0;
    let totalReceivedValue = 0;
    const now = new Date();
    const monthStartTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    for (const g of rows) {
      const status = (typeof g.status === 'string' ? g.status : '').toLowerCase();
      if (status === 'draft' || status === '') {
        pendingQcCount += 1;
      } else if (status === 'posted') {
        acceptedCount += 1;
      } else if (status === 'rejected') {
        rejectedCount += 1;
      } else if (status === 'inspected') {
        // Partial-accept hint: any rejected qty across the items?
        const hasRejected = (g.items ?? []).some(
          (it) => Number(it.rejectedQty) > 0,
        );
        if (hasRejected) partiallyAcceptedCount += 1;
        else acceptedCount += 1;
      }
      // MTD bucket: receipt date in current calendar month.
      const dateTs = g.date ? new Date(g.date).getTime() : NaN;
      if (!Number.isNaN(dateTs) && dateTs >= monthStartTs) mtdCount += 1;
      // "Total received value" — GRN lines don't carry unit cost on the
      // wire, so we approximate by summing accepted units across all
      // non-rejected GRNs. The UI labels this as "units received".
      if (status !== 'rejected') {
        for (const it of g.items ?? []) {
          const accepted = Number(it.acceptedQty) || 0;
          if (accepted > 0) totalReceivedValue += accepted;
        }
      }
    }
    return {
      pendingQcCount,
      acceptedCount,
      partiallyAcceptedCount,
      rejectedCount,
      mtdCount,
      totalReceivedValue,
      totalReceivedCurrency: 'INR',
    };
  } catch {
    return EMPTY_GRN_KPIS;
  }
}

/* ─── Inline status / bulk mutators ───────────────────────────── */

const GRN_STATUSES = ['draft', 'inspected', 'posted', 'rejected'] as const;

function isGrnStatus(s: string): boolean {
  return (GRN_STATUSES as readonly string[]).includes(s);
}

/** Mark a single GRN with a new workflow status. */
export async function setGrnStatus(
  id: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing GRN id.' };
  if (!isGrnStatus(status)) {
    return { success: false, error: 'Invalid status.' };
  }
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_grn', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmGrnsApi.update(id, { status });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'grn',
        entityId: id,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    console.error('[setGrnStatus] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'grn', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/** Run a bulk operation across many GRNs. */
export async function bulkGrnAction(
  ids: string[],
  op: 'delete' | 'status',
  payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No GRNs selected.' };
  }
  const session = await getSession();
  if (!session?.user) return { success: false, processed: 0, error: 'Unauthorized' };
  const guard = await requirePermission('crm_grn', op === 'delete' ? 'delete' : 'edit');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  try {
    let processed = 0;
    for (const id of ids) {
      try {
        if (op === 'delete') {
          await crmGrnsApi.delete(id);
        } else if (op === 'status') {
          const s = (payload ?? '').toLowerCase();
          if (!isGrnStatus(s)) continue;
          await crmGrnsApi.update(id, { status: s });
        }
        processed += 1;
      } catch (e) {
        console.error('[bulkGrnAction] per-row failure:', e);
        recordRustFallback({ entity: 'grn', op: op === 'delete' ? 'delete' : 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
      }
    }
    if (processed > 0) {
      try {
        for (const id of ids.slice(0, processed)) {
          await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: op === 'delete' ? 'delete' : 'status_change',
            entityKind: 'grn',
            entityId: id,
            reason: op === 'status' ? `bulk:status=${payload}` : 'bulk:delete',
          });
        }
      } catch {
        /* non-fatal */
      }
    }
    revalidatePath(LIST_PATH);
    return { success: processed > 0, processed };
  } catch (e) {
    return { success: false, processed: 0, error: rustErr(e) };
  }
}

/* ─── PO seed for the "Convert PO → GRN" flow ─────────────────── */

interface GrnSeed {
  vendorId?: string;
  warehouseId?: string;
  poId?: string;
  items?: Array<{
    itemId: string;
    orderedQty: number;
  }>;
}

/**
 * Build a `GrnSeed` from a Purchase Order id. The Rust BFF for POs
 * isn't unified yet, so we resolve via the legacy action layer.
 */
export async function getGrnSeedFromPo(poId: string): Promise<GrnSeed | null> {
  if (!poId) return null;
  try {
    // Legacy Mongo action — keeps the file dependency-light vs the
    // full purchaseOrders crate. The PO doc shape carries `vendorId`,
    // `warehouseId`, and `items[]` with `qty` / `itemId`.
    const mod = await import('@/app/actions/crm-purchase-orders.actions');
    const poRaw = await mod.getPurchaseOrderById(poId);
    if (!poRaw) return null;
    
    // Cast to CrmPurchaseOrderDoc from the Rust client for type safety
    // since the runtime shape often includes `items` instead of legacy `lineItems`.
    const po = poRaw as unknown as import('@/lib/rust-client/crm-purchase-orders').CrmPurchaseOrderDoc;
    
    return {
      poId,
      vendorId: po.vendorId ? String(po.vendorId) : undefined,
      warehouseId: po.warehouseId ? String(po.warehouseId) : undefined,
      items: Array.isArray(po.items)
        ? po.items
            .filter((it) => it?.itemId)
            .map((it) => ({
              itemId: String(it.itemId),
              orderedQty: Number(it.qty ?? (it as any).orderedQty ?? 0),
            }))
        : [],
    };
  } catch {
    return null;
  }
}
