'use server';

/**
 * CRM Debit Note server actions.
 *
 * Thin shims over the Rust BFF (`crmDebitNotesApi`). No direct Mongo
 * access. FormData callers (the form pages) hit `saveDebitNoteAction`
 * / `deleteDebitNoteAction`; programmatic callers can use the typed
 * helpers (`listDebitNotes`, `getDebitNote`).
 *
 * Note: `'debitNote'` is NOT in `WsCustomFieldBelongsTo`, so custom
 * fields are deliberately skipped here.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmDebitNotesApi,
  type CrmDebitNoteCreateInput,
  type CrmDebitNoteDoc,
  type CrmDebitNoteLineItem,
  type CrmDebitNoteListParams,
  type CrmDebitNoteTotals,
  type CrmDebitNoteUpdateInput,
  type DebitNoteReason,
  type DebitNoteRefundMode,
  type DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';

const LIST_PATH = '/dashboard/crm/purchases/debit-notes';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

interface DebitNoteListResult {
  debitNotes: CrmDebitNoteDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listDebitNotes(
  params: CrmDebitNoteListParams = {},
): Promise<DebitNoteListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const debitNotes = await crmDebitNotesApi.list({ ...params, page, limit });
    return { debitNotes, page, limit, hasMore: debitNotes.length === limit };
  } catch (e) {
    return { debitNotes: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getDebitNote(
  id: string,
): Promise<{ debitNote: CrmDebitNoteDoc | null; error?: string }> {
  if (!id) return { debitNote: null, error: 'Missing debit note id.' };
  try {
    const debitNote = await crmDebitNotesApi.getById(id);
    return { debitNote };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { debitNote: null, error: 'Debit note not found.' };
    }
    return { debitNote: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

const REASONS: readonly DebitNoteReason[] = [
  'return',
  'discount',
  'price_adjust',
  'cancel',
  'other',
];

const STATUSES: readonly DebitNoteStatus[] = ['draft', 'issued', 'refunded', 'cancelled'];

const REFUND_MODES: readonly DebitNoteRefundMode[] = ['cash', 'credit', 'replacement'];

function pickReason(formData: FormData): DebitNoteReason | undefined {
  const v = pickString(formData, 'reason');
  if (!v) return undefined;
  return REASONS.includes(v as DebitNoteReason) ? (v as DebitNoteReason) : undefined;
}

function pickStatus(formData: FormData): DebitNoteStatus | undefined {
  const v = pickString(formData, 'status');
  if (!v) return undefined;
  return STATUSES.includes(v as DebitNoteStatus) ? (v as DebitNoteStatus) : undefined;
}

function pickRefundMode(formData: FormData): DebitNoteRefundMode | undefined {
  const v = pickString(formData, 'refundMode');
  if (!v) return undefined;
  return REFUND_MODES.includes(v as DebitNoteRefundMode)
    ? (v as DebitNoteRefundMode)
    : undefined;
}

function parseItems(formData: FormData): CrmDebitNoteLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): CrmDebitNoteLineItem | null => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const qty = Number(r.qty);
        const rate = Number(r.rate);
        const total = Number(r.total);
        return {
          itemId: typeof r.itemId === 'string' ? r.itemId : undefined,
          description: typeof r.description === 'string' ? r.description : undefined,
          hsnSac: typeof r.hsnSac === 'string' ? r.hsnSac : undefined,
          qty: Number.isFinite(qty) ? qty : 0,
          unit: typeof r.unit === 'string' ? r.unit : undefined,
          rate: Number.isFinite(rate) ? rate : 0,
          discountPct:
            typeof r.discountPct === 'number' && Number.isFinite(r.discountPct)
              ? r.discountPct
              : undefined,
          taxRatePct:
            typeof r.taxRatePct === 'number' && Number.isFinite(r.taxRatePct)
              ? r.taxRatePct
              : undefined,
          total: Number.isFinite(total) ? total : 0,
        };
      })
      .filter((r): r is CrmDebitNoteLineItem => r !== null);
  } catch {
    return [];
  }
}

function parseTotals(formData: FormData): CrmDebitNoteTotals {
  const raw = formData.get('totals');
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const t = parsed as Record<string, unknown>;
        const subTotal = Number(t.subTotal);
        const total = Number(t.total);
        return {
          subTotal: Number.isFinite(subTotal) ? subTotal : 0,
          discountOverall:
            typeof t.discountOverall === 'number' && Number.isFinite(t.discountOverall)
              ? t.discountOverall
              : undefined,
          shippingCharge:
            typeof t.shippingCharge === 'number' && Number.isFinite(t.shippingCharge)
              ? t.shippingCharge
              : undefined,
          adjustment:
            typeof t.adjustment === 'number' && Number.isFinite(t.adjustment)
              ? t.adjustment
              : undefined,
          roundOff:
            typeof t.roundOff === 'number' && Number.isFinite(t.roundOff) ? t.roundOff : undefined,
          total: Number.isFinite(total) ? total : 0,
        };
      }
    } catch {
      // fall through to fallback below
    }
  }
  return { subTotal: 0, total: 0 };
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST.
 */
export async function saveDebitNoteAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const dnNo = pickString(formData, 'dnNo');
  const dateStr = pickString(formData, 'date');
  const vendorId = pickString(formData, 'vendorId');
  const reason = pickReason(formData);
  const currency = pickString(formData, 'currency') ?? 'INR';
  const refundMode = pickRefundMode(formData);
  const items = parseItems(formData);
  const totals = parseTotals(formData);

  // Create requires every "★ required" field per the Rust DTO. PATCH is
  // tolerant — only the supplied fields are sent.
  if (!id) {
    if (!dnNo) return { error: 'Debit note number is required.' };
    if (!dateStr) return { error: 'Date is required.' };
    if (!vendorId) return { error: 'Vendor is required.' };
    if (!reason) return { error: 'Reason is required.' };
    if (!refundMode) return { error: 'Refund mode is required.' };
    if (items.length === 0) return { error: 'At least one line item is required.' };
  }

  try {
    let result: CrmDebitNoteDoc;
    if (id) {
      const patch: CrmDebitNoteUpdateInput = {
        dnNo,
        date: dateStr,
        vendorId,
        linkedBillId: pickString(formData, 'linkedBillId'),
        reason,
        currency,
        items: items.length > 0 ? items : undefined,
        totals: items.length > 0 ? totals : undefined,
        refundMode,
        refundTxnId: pickString(formData, 'refundTxnId'),
        notes: pickString(formData, 'notes'),
        status: pickStatus(formData),
      };
      result = await crmDebitNotesApi.update(id, patch);
    } else {
      const draft: CrmDebitNoteCreateInput = {
        dnNo: dnNo!,
        // The Rust DTO accepts an ISO-8601 timestamp.
        date: new Date(dateStr!).toISOString(),
        vendorId: vendorId!,
        linkedBillId: pickString(formData, 'linkedBillId'),
        reason: reason!,
        currency,
        items,
        totals,
        refundMode: refundMode!,
        refundTxnId: pickString(formData, 'refundTxnId'),
        notes: pickString(formData, 'notes'),
      };
      result = await crmDebitNotesApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Debit note updated.' : 'Debit note created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a debit note. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteDebitNoteAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing debit note id.' };
  try {
    await crmDebitNotesApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Debit note not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

interface DebitNoteKpis {
  totalCount: number;
  refundedCount: number;
  pendingRefundCount: number;
  linkedBillValue: number;
  currency: string;
}

const EMPTY_DN_KPIS: DebitNoteKpis = {
  totalCount: 0,
  refundedCount: 0,
  pendingRefundCount: 0,
  linkedBillValue: 0,
  currency: 'INR',
};

/**
 * Derive debit-note KPIs from a wide page. Mirrors the credit-note KPI
 * shape — "linked invoice value" is replaced by "linked bill value".
 */
export async function getDebitNoteKpis(): Promise<DebitNoteKpis> {
  try {
    const rows = await crmDebitNotesApi.list({ page: 1, limit: 100 });
    if (!Array.isArray(rows) || rows.length === 0) return EMPTY_DN_KPIS;
    let refundedCount = 0;
    let pendingRefundCount = 0;
    let linkedBillValue = 0;
    let currency = 'INR';
    for (const dn of rows) {
      currency = dn.currency || currency;
      const status = (dn.status || '').toLowerCase();
      if (status === 'refunded') refundedCount += 1;
      else if (status !== 'cancelled') pendingRefundCount += 1;
      if (dn.linkedBillId) {
        linkedBillValue += Number(dn.totals?.total) || 0;
      }
    }
    return {
      totalCount: rows.length,
      refundedCount,
      pendingRefundCount,
      linkedBillValue,
      currency,
    };
  } catch {
    return EMPTY_DN_KPIS;
  }
}

/* ─── Inline status / bulk mutators ───────────────────────────── */

function isDnStatus(s: string): s is DebitNoteStatus {
  return (STATUSES as readonly string[]).includes(s);
}

/** Mark a single debit note with a new workflow status. */
export async function setDebitNoteStatus(
  id: string,
  status: DebitNoteStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing debit note id.' };
  if (!isDnStatus(status)) {
    return { success: false, error: 'Invalid status.' };
  }
  try {
    await crmDebitNotesApi.update(id, { status });
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

/** Run a bulk operation across many debit notes. */
export async function bulkDebitNoteAction(
  ids: string[],
  op: 'archive' | 'delete' | 'refund',
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No debit notes selected.' };
  }
  try {
    let processed = 0;
    for (const id of ids) {
      try {
        if (op === 'delete') {
          await crmDebitNotesApi.delete(id);
        } else if (op === 'refund') {
          await crmDebitNotesApi.update(id, { status: 'refunded' });
        } else if (op === 'archive') {
          // No `archived` flag on the Rust patch — set status=cancelled
          // as a best-effort proxy (mirrors credit-notes behaviour).
          await crmDebitNotesApi.update(id, { status: 'cancelled' });
        }
        processed += 1;
      } catch {
        // continue on per-row failure
      }
    }
    revalidatePath(LIST_PATH);
    return { success: processed > 0, processed };
  } catch (e) {
    return { success: false, processed: 0, error: rustErr(e) };
  }
}
