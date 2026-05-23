'use server';

import { cn } from '@/components/zoruui';
/**
 * CRM Credit Note server actions.
 *
 * Thin shims over the Rust BFF (`crmCreditNotesApi`). No direct Mongo
 * access. FormData callers (the form pages) hit `saveCreditNoteAction`
 * / `deleteCreditNoteAction`; programmatic callers can use the typed
 * helpers (`listCreditNotes`, `getCreditNote`).
 *
 * Note: `'creditNote'` is NOT in `WsCustomFieldBelongsTo`, so custom
 * fields are deliberately skipped here.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmCreditNotesApi,
  type CrmCreditNoteCreateInput,
  type CrmCreditNoteDoc,
  type CrmCreditNoteListParams,
  type CrmCreditNoteUpdateInput,
  type CreditNoteLineItem,
  type CreditNoteReason,
  type CreditNoteStatus,
  type CreditNoteTotals,
  type RefundMode,
} from '@/lib/rust-client/crm-credit-notes';

const LIST_PATH = '/dashboard/crm/sales/credit-notes';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface CreditNoteListResult {
  creditNotes: CrmCreditNoteDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listCreditNotes(
  params: CrmCreditNoteListParams = {},
): Promise<CreditNoteListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const creditNotes = await crmCreditNotesApi.list({ ...params, page, limit });
    return { creditNotes, page, limit, hasMore: creditNotes.length === limit };
  } catch (e) {
    return { creditNotes: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getCreditNote(
  id: string,
): Promise<{ creditNote: CrmCreditNoteDoc | null; error?: string }> {
  if (!id) return { creditNote: null, error: 'Missing credit note id.' };
  try {
    const creditNote = await crmCreditNotesApi.getById(id);
    return { creditNote };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { creditNote: null, error: 'Credit note not found.' };
    }
    return { creditNote: null, error: rustErr(e) };
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

function pickBool(formData: FormData, key: string): boolean | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v === 'true' || v === 'on' || v === '1';
}

const REASONS: readonly CreditNoteReason[] = [
  'return',
  'discount',
  'price_adjust',
  'cancel',
  'other',
];

const STATUSES: readonly CreditNoteStatus[] = ['draft', 'issued', 'refunded', 'cancelled'];

const REFUND_MODES: readonly RefundMode[] = ['cash', 'credit', 'replacement'];

function pickReason(formData: FormData): CreditNoteReason | undefined {
  const v = pickString(formData, 'reason');
  if (!v) return undefined;
  return REASONS.includes(v as CreditNoteReason) ? (v as CreditNoteReason) : undefined;
}

function pickStatus(formData: FormData): CreditNoteStatus | undefined {
  const v = pickString(formData, 'status');
  if (!v) return undefined;
  return STATUSES.includes(v as CreditNoteStatus) ? (v as CreditNoteStatus) : undefined;
}

function pickRefundMode(formData: FormData): RefundMode | undefined {
  const v = pickString(formData, 'refundMode');
  if (!v) return undefined;
  return REFUND_MODES.includes(v as RefundMode) ? (v as RefundMode) : undefined;
}

function parseItems(formData: FormData): CreditNoteLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): CreditNoteLineItem | null => {
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
      .filter((r): r is CreditNoteLineItem => r !== null);
  } catch {
    return [];
  }
}

function parseTotals(formData: FormData): CreditNoteTotals {
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
export async function saveCreditNoteAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const cnNo = pickString(formData, 'cnNo');
  const dateStr = pickString(formData, 'date');
  const clientId = pickString(formData, 'clientId');
  const reason = pickReason(formData);
  const currency = pickString(formData, 'currency') ?? 'INR';
  const refundMode = pickRefundMode(formData);
  const items = parseItems(formData);
  const totals = parseTotals(formData);

  // Create requires every "★ required" field per the Rust DTO. PATCH is
  // tolerant — only the supplied fields are sent.
  if (!id) {
    if (!cnNo) return { error: 'Credit note number is required.' };
    if (!dateStr) return { error: 'Date is required.' };
    if (!clientId) return { error: 'Customer is required.' };
    if (!reason) return { error: 'Reason is required.' };
    if (!refundMode) return { error: 'Refund mode is required.' };
    if (items.length === 0) return { error: 'At least one line item is required.' };
  }

  try {
    let result: CrmCreditNoteDoc;
    if (id) {
      const patch: CrmCreditNoteUpdateInput = {
        cnNo,
        date: dateStr,
        clientId,
        linkedInvoiceId: pickString(formData, 'linkedInvoiceId'),
        reason,
        currency,
        items: items.length > 0 ? items : undefined,
        totals: items.length > 0 ? totals : undefined,
        taxRecalc: pickBool(formData, 'taxRecalc'),
        refundMode,
        refundTxnId: pickString(formData, 'refundTxnId'),
        autoApply: pickBool(formData, 'autoApply'),
        notes: pickString(formData, 'notes'),
        status: pickStatus(formData),
      };
      result = await crmCreditNotesApi.update(id, patch);
    } else {
      const draft: CrmCreditNoteCreateInput = {
        cnNo: cnNo!,
        // The Rust DTO accepts an ISO-8601 timestamp.
        date: new Date(dateStr!).toISOString(),
        clientId: clientId!,
        linkedInvoiceId: pickString(formData, 'linkedInvoiceId'),
        reason: reason!,
        currency,
        items,
        totals,
        taxRecalc: pickBool(formData, 'taxRecalc'),
        refundMode: refundMode!,
        refundTxnId: pickString(formData, 'refundTxnId'),
        autoApply: pickBool(formData, 'autoApply'),
        notes: pickString(formData, 'notes'),
      };
      result = await crmCreditNotesApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Credit note updated.' : 'Credit note created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a credit note. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteCreditNoteAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing credit note id.' };
  try {
    await crmCreditNotesApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Credit note not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export interface CreditNoteKpis {
  totalCount: number;
  refundedCount: number;
  pendingRefundCount: number;
  linkedInvoiceValue: number;
  currency: string;
}

const EMPTY_CN_KPIS: CreditNoteKpis = {
  totalCount: 0,
  refundedCount: 0,
  pendingRefundCount: 0,
  linkedInvoiceValue: 0,
  currency: 'INR',
};

/**
 * Derive credit-note KPIs from a wide page. The Rust BFF doesn't expose
 * an aggregate endpoint yet — compute on the server from the first
 * 100 rows.
 */
export async function getCreditNoteKpis(): Promise<CreditNoteKpis> {
  try {
    const rows = await crmCreditNotesApi.list({ page: 1, limit: 100 });
    if (!Array.isArray(rows) || rows.length === 0) return EMPTY_CN_KPIS;
    let refundedCount = 0;
    let pendingRefundCount = 0;
    let linkedInvoiceValue = 0;
    let currency = 'INR';
    for (const cn of rows) {
      currency = cn.currency || currency;
      const status = (cn.status || '').toLowerCase();
      if (status === 'refunded') refundedCount += 1;
      else if (status !== 'cancelled') pendingRefundCount += 1;
      if (cn.linkedInvoiceId) {
        linkedInvoiceValue += Number(cn.totals?.total) || 0;
      }
    }
    return {
      totalCount: rows.length,
      refundedCount,
      pendingRefundCount,
      linkedInvoiceValue,
      currency,
    };
  } catch {
    return EMPTY_CN_KPIS;
  }
}

/* ─── Inline status / bulk mutators ───────────────────────────── */

const CN_STATUSES: readonly CreditNoteStatus[] = [
  'draft',
  'issued',
  'refunded',
  'cancelled',
];

function isCnStatus(s: string): s is CreditNoteStatus {
  return (CN_STATUSES as readonly string[]).includes(s);
}

/** Mark a single credit note with a new workflow status. */
export async function setCreditNoteStatus(
  id: string,
  status: CreditNoteStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing credit note id.' };
  if (!isCnStatus(status)) return { success: false, error: 'Invalid status.' };
  try {
    await crmCreditNotesApi.update(id, { status });
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

/** Run a bulk operation across many credit notes. */
export async function bulkCreditNoteAction(
  ids: string[],
  op: 'archive' | 'delete' | 'refund',
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No credit notes selected.' };
  }
  try {
    let processed = 0;
    for (const id of ids) {
      try {
        if (op === 'delete') {
          await crmCreditNotesApi.delete(id);
        } else if (op === 'refund') {
          await crmCreditNotesApi.update(id, { status: 'refunded' });
        } else if (op === 'archive') {
          // No `archived` flag on the Rust patch — TODO 1D.x: surface
          // a first-class archived flag once the Rust DTO grows one.
          await crmCreditNotesApi.update(id, { status: 'cancelled' });
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
