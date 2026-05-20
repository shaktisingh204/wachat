'use server';

/**
 * CRM Payment Receipt server actions.
 *
 * Thin shims over the Rust BFF (`crmPaymentReceiptsApi`). No direct
 * Mongo access. FormData callers (the create/edit form) hit
 * `savePaymentReceiptAction` / `deletePaymentReceiptAction`;
 * programmatic callers can use the typed helpers (`listPaymentReceipts`,
 * `getPaymentReceipt`, etc.).
 *
 * Note: `'paymentReceipt'` is NOT in `WsCustomFieldBelongsTo`, so this
 * action layer deliberately skips custom-fields plumbing.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmPaymentReceiptsApi,
  type CrmInvoiceApplication,
  type CrmPaymentMode,
  type CrmPaymentReceiptCreateInput,
  type CrmPaymentReceiptDoc,
  type CrmPaymentReceiptListParams,
  type CrmPaymentReceiptUpdateInput,
  type CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';

const LIST_PATH = '/dashboard/crm/sales/receipts';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

const ALLOWED_MODES: readonly CrmPaymentMode[] = [
  'cash',
  'cheque',
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
];

const ALLOWED_STATUSES: readonly CrmReceiptStatus[] = [
  'received',
  'cleared',
  'bounced',
];

function asMode(v: string | undefined): CrmPaymentMode | undefined {
  if (!v) return undefined;
  const lc = v.trim().toLowerCase();
  return (ALLOWED_MODES as readonly string[]).includes(lc)
    ? (lc as CrmPaymentMode)
    : undefined;
}

function asStatus(v: string | undefined): CrmReceiptStatus | undefined {
  if (!v) return undefined;
  const lc = v.trim().toLowerCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(lc)
    ? (lc as CrmReceiptStatus)
    : undefined;
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface PaymentReceiptListResult {
  receipts: CrmPaymentReceiptDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listPaymentReceipts(
  params: CrmPaymentReceiptListParams = {},
): Promise<PaymentReceiptListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const receipts = await crmPaymentReceiptsApi.list({ ...params, page, limit });
    return { receipts, page, limit, hasMore: receipts.length === limit };
  } catch (e) {
    return { receipts: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getPaymentReceipt(
  id: string,
): Promise<{ receipt: CrmPaymentReceiptDoc | null; error?: string }> {
  if (!id) return { receipt: null, error: 'Missing receipt id.' };
  try {
    const receipt = await crmPaymentReceiptsApi.getById(id);
    return { receipt };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { receipt: null, error: 'Payment receipt not found.' };
    }
    return { receipt: null, error: rustErr(e) };
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

/**
 * Parse the receipt → invoice allocation table out of the form.
 *
 * Accepts BOTH a single JSON blob under `applyTo` (preferred — matches
 * the credit-note pattern) AND indexed flat keys like `applyTo[0].invoiceId`
 * / `applyTo[0].amount` for backwards-compat with the legacy form. Empty
 * or zero-amount rows are filtered out.
 */
function parseApplyTo(formData: FormData): CrmInvoiceApplication[] {
  const raw = formData.get('applyTo');
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((row): CrmInvoiceApplication | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const invoiceId = typeof r.invoiceId === 'string' ? r.invoiceId.trim() : '';
            const amount = Number(r.amount);
            if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return null;
            return { invoiceId, amount };
          })
          .filter((r): r is CrmInvoiceApplication => r !== null);
      }
    } catch {
      // fall through to flat-key parse below
    }
  }

  // Flat-key fallback: applyTo[0].invoiceId / applyTo[0].amount …
  const acc = new Map<number, { invoiceId?: string; amount?: number }>();
  for (const [key, value] of formData.entries()) {
    const m = /^applyTo\[(\d+)\]\.(invoiceId|amount)$/.exec(key);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2] as 'invoiceId' | 'amount';
    const v = typeof value === 'string' ? value.trim() : '';
    const slot = acc.get(idx) ?? {};
    if (field === 'invoiceId' && v) slot.invoiceId = v;
    if (field === 'amount' && v) {
      const n = Number(v);
      if (Number.isFinite(n)) slot.amount = n;
    }
    acc.set(idx, slot);
  }
  return Array.from(acc.values())
    .filter((r): r is { invoiceId: string; amount: number } =>
      typeof r.invoiceId === 'string' &&
      r.invoiceId.length > 0 &&
      typeof r.amount === 'number' &&
      r.amount > 0,
    )
    .map((r) => ({ invoiceId: r.invoiceId, amount: r.amount }));
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Note: financial fields (`amount`, `mode`, `clientId`,
 * `currency`) are not patchable on the Rust side — they are accepted
 * from the form only on create.
 */
export async function savePaymentReceiptAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const receiptNo = pickString(formData, 'receiptNo');
  const date = pickString(formData, 'date');
  const clientId = pickString(formData, 'clientId');
  const modeRaw = pickString(formData, 'mode');
  const bankAccountId = pickString(formData, 'bankAccountId');
  const amount = pickNumber(formData, 'amount');
  const currency = pickString(formData, 'currency') ?? 'INR';

  try {
    let result: CrmPaymentReceiptDoc;
    if (id) {
      // PATCH — financial fields are NOT settable; only the mutable
      // subset per UpdatePaymentReceiptInput.
      const patch: CrmPaymentReceiptUpdateInput = {
        receiptNo,
        date,
        bankAccountId,
        chequeNo: pickString(formData, 'chequeNo'),
        chequeDate: pickString(formData, 'chequeDate'),
        txnId: pickString(formData, 'txnId'),
        reference: pickString(formData, 'reference'),
        tdsDeducted: pickNumber(formData, 'tdsDeducted'),
        bankCharges: pickNumber(formData, 'bankCharges'),
        notes: pickString(formData, 'notes'),
        status: asStatus(pickString(formData, 'status')),
      };
      result = await crmPaymentReceiptsApi.update(id, patch);
    } else {
      if (!receiptNo) return { error: 'Receipt number is required.' };
      if (!date) return { error: 'Date is required.' };
      if (!clientId) return { error: 'Customer is required.' };
      if (!bankAccountId) return { error: 'Bank account is required.' };
      const mode = asMode(modeRaw);
      if (!mode) return { error: 'Payment method is required.' };
      if (typeof amount !== 'number' || amount <= 0) {
        return { error: 'Amount must be greater than zero.' };
      }

      const applyTo = parseApplyTo(formData);
      const fromKindRaw = pickString(formData, 'fromKind');
      const fromKind =
        fromKindRaw === 'invoice' || fromKindRaw === 'proforma'
          ? (fromKindRaw as 'invoice' | 'proforma')
          : undefined;
      const fromId = pickString(formData, 'fromId');

      const draft: CrmPaymentReceiptCreateInput = {
        receiptNo,
        date,
        clientId,
        mode,
        bankAccountId,
        amount,
        currency,
        exchangeRate: pickNumber(formData, 'exchangeRate'),
        chequeNo: pickString(formData, 'chequeNo'),
        chequeDate: pickString(formData, 'chequeDate'),
        txnId: pickString(formData, 'txnId'),
        reference: pickString(formData, 'reference'),
        tdsDeducted: pickNumber(formData, 'tdsDeducted'),
        bankCharges: pickNumber(formData, 'bankCharges'),
        notes: pickString(formData, 'notes'),
        applyTo: applyTo.length > 0 ? applyTo : undefined,
        excessAsAdvance: pickBool(formData, 'excessAsAdvance') ?? false,
        fromKind,
        fromId: fromKind ? fromId : undefined,
      };
      result = await crmPaymentReceiptsApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Payment receipt updated.' : 'Payment receipt created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a payment receipt. The Rust handler removes the row from
 * the collection — no soft-delete flag.
 */
export async function deletePaymentReceiptAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing receipt id.' };
  try {
    await crmPaymentReceiptsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Payment receipt not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmPaymentReceiptsApi.x(...)`.

export async function createPaymentReceipt(
  input: CrmPaymentReceiptCreateInput,
) {
  return crmPaymentReceiptsApi.create(input);
}

export async function updatePaymentReceipt(
  id: string,
  patch: CrmPaymentReceiptUpdateInput,
) {
  return crmPaymentReceiptsApi.update(id, patch);
}

export async function deletePaymentReceipt(id: string) {
  return crmPaymentReceiptsApi.delete(id);
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export interface PaymentReceiptKpis {
  receivedThisMonthTotal: number;
  receivedThisMonthCount: number;
  clearedCount: number;
  bouncedCount: number;
  avgDaysToCollect: number;
  currency: string;
  /** Count of receipts not yet cleared (status = received or unset). */
  pendingCount: number;
  /** Count of receipts that bounced or are unreconciled. */
  failedCount: number;
  /** Most-used payment mode across the loaded window (e.g. `upi`). */
  topMethod: string;
}

const EMPTY_KPIS: PaymentReceiptKpis = {
  receivedThisMonthTotal: 0,
  receivedThisMonthCount: 0,
  clearedCount: 0,
  bouncedCount: 0,
  avgDaysToCollect: 0,
  currency: 'INR',
  pendingCount: 0,
  failedCount: 0,
  topMethod: '—',
};

/**
 * Derive header KPIs from the loaded page. The Rust BFF doesn't expose
 * an aggregate endpoint yet, so we walk a wider page (up to 100) and
 * compute on the server.
 */
export async function getPaymentReceiptKpis(): Promise<PaymentReceiptKpis> {
  try {
    const rows = await crmPaymentReceiptsApi.list({ page: 1, limit: 100 });
    if (!Array.isArray(rows) || rows.length === 0) return EMPTY_KPIS;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let receivedThisMonthTotal = 0;
    let receivedThisMonthCount = 0;
    let clearedCount = 0;
    let bouncedCount = 0;
    let pendingCount = 0;
    let daySum = 0;
    let daySamples = 0;
    let currency = 'INR';
    const methodCounts = new Map<string, number>();
    for (const r of rows) {
      currency = r.currency || currency;
      const dt = r.date ? new Date(r.date) : null;
      if (dt && !isNaN(dt.getTime()) && dt >= monthStart) {
        receivedThisMonthTotal += Number(r.amount) || 0;
        receivedThisMonthCount += 1;
      }
      const status = (r.status || '').toLowerCase();
      if (status === 'cleared') clearedCount += 1;
      if (status === 'bounced') bouncedCount += 1;
      if (status === 'received' || status === '') pendingCount += 1;

      if (r.mode) {
        const mode = String(r.mode).toLowerCase();
        methodCounts.set(mode, (methodCounts.get(mode) ?? 0) + 1);
      }

      // Days-to-collect proxy: receipt.date − earliest applied invoice.
      // We don't have invoice dates loaded here, so we fall back to
      // (createdAt − date) in days for a rough estimate.
      const created = r.createdAt ? new Date(r.createdAt) : null;
      if (dt && created && !isNaN(dt.getTime()) && !isNaN(created.getTime())) {
        const days = Math.max(0, (created.getTime() - dt.getTime()) / 86_400_000);
        if (Number.isFinite(days) && days < 365) {
          daySum += days;
          daySamples += 1;
        }
      }
    }
    let topMethod = '—';
    let topCount = -1;
    for (const [k, v] of methodCounts) {
      if (v > topCount) {
        topMethod = k;
        topCount = v;
      }
    }
    return {
      receivedThisMonthTotal,
      receivedThisMonthCount,
      clearedCount,
      bouncedCount,
      avgDaysToCollect: daySamples > 0 ? Math.round(daySum / daySamples) : 0,
      currency,
      pendingCount,
      failedCount: bouncedCount,
      topMethod,
    };
  } catch {
    return EMPTY_KPIS;
  }
}

/* ─── Inline status / bulk mutators ───────────────────────────── */

const STATUS_ALLOWED: readonly CrmReceiptStatus[] = ['received', 'cleared', 'bounced'];

function isStatus(s: string): s is CrmReceiptStatus {
  return (STATUS_ALLOWED as readonly string[]).includes(s);
}

/** Mark a single receipt with a new workflow status. */
export async function setPaymentReceiptStatus(
  id: string,
  status: CrmReceiptStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing receipt id.' };
  if (!isStatus(status)) return { success: false, error: 'Invalid status.' };
  try {
    await crmPaymentReceiptsApi.update(id, { status });
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

/** Run a bulk operation across many receipts. */
export async function bulkPaymentReceiptAction(
  ids: string[],
  op: 'archive' | 'delete' | 'status',
  payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No receipts selected.' };
  }
  try {
    let processed = 0;
    for (const id of ids) {
      try {
        if (op === 'delete') {
          await crmPaymentReceiptsApi.delete(id);
        } else if (op === 'status') {
          const s = (payload ?? '').toLowerCase();
          if (!isStatus(s)) continue;
          await crmPaymentReceiptsApi.update(id, { status: s });
        } else if (op === 'archive') {
          // No `archived` flag on the Rust patch — best-effort: mark
          // `notes` with an [archived] tag so it survives a re-read.
          // TODO 1D.x: surface a first-class archived flag once the
          // Rust DTO grows one.
          await crmPaymentReceiptsApi.update(id, {
            notes: '[archived]',
          });
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
