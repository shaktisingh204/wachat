'use server';

/**
 * CRM Payout server actions.
 *
 * Thin shims over the Rust BFF (`crmPayoutsApi`). No direct Mongo
 * access. FormData callers (the create/edit form) hit
 * `savePayoutAction` / `deletePayoutAction`; programmatic callers can
 * use the typed helpers (`listPayouts`, `getPayout`, etc.).
 *
 * §1D rebuild adds KPI aggregation (`getPayoutKpis`), inline status
 * mutation (`setPayoutStatus`), and bulk operations
 * (`bulkPayoutAction`) — buy-side mirror of the receipt action shape.
 *
 * Note: `'payout'` is NOT in `WsCustomFieldBelongsTo`, so this action
 * layer deliberately skips custom-fields plumbing.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmPayoutsApi,
  type CrmBillApplication,
  type CrmPayoutCreateInput,
  type CrmPayoutDoc,
  type CrmPayoutListParams,
  type CrmPayoutMode,
  type CrmPayoutStatus,
  type CrmPayoutUpdateInput,
} from '@/lib/rust-client/crm-payouts';
import { crmBillsApi } from '@/lib/rust-client/crm-bills';

const LIST_PATH = '/dashboard/crm/purchases/payouts';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

const ALLOWED_MODES: readonly CrmPayoutMode[] = [
  'cash',
  'cheque',
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
];

const ALLOWED_STATUSES: readonly CrmPayoutStatus[] = ['sent', 'cleared', 'failed'];

function asMode(v: string | undefined): CrmPayoutMode | undefined {
  if (!v) return undefined;
  const lc = v.trim().toLowerCase();
  return (ALLOWED_MODES as readonly string[]).includes(lc)
    ? (lc as CrmPayoutMode)
    : undefined;
}

function asStatus(v: string | undefined): CrmPayoutStatus | undefined {
  if (!v) return undefined;
  const lc = v.trim().toLowerCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(lc)
    ? (lc as CrmPayoutStatus)
    : undefined;
}

/* ─── Read ────────────────────────────────────────────────────── */

interface PayoutListResult {
  payouts: CrmPayoutDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listPayouts(
  params: CrmPayoutListParams = {},
): Promise<PayoutListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const payouts = await crmPayoutsApi.list({ ...params, page, limit });
    return { payouts, page, limit, hasMore: payouts.length === limit };
  } catch (e) {
    return { payouts: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getPayout(
  id: string,
): Promise<{ payout: CrmPayoutDoc | null; error?: string }> {
  if (!id) return { payout: null, error: 'Missing payout id.' };
  try {
    const payout = await crmPayoutsApi.getById(id);
    return { payout };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { payout: null, error: 'Payout not found.' };
    }
    return { payout: null, error: rustErr(e) };
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
 * Parse the `applyTo` payload from form data. Accepts either a single
 * JSON blob keyed `applyTo` (preferred — mirrors the receipts pattern)
 * or flat `applyTo[N].billId` / `applyTo[N].amount` entries (legacy).
 */
function parseApplyTo(formData: FormData): CrmBillApplication[] {
  const blob = formData.get('applyTo');
  if (typeof blob === 'string' && blob.trim().length > 0) {
    try {
      const parsed = JSON.parse(blob);
      if (Array.isArray(parsed)) {
        return parsed
          .map((row): CrmBillApplication | null => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const billId = typeof r.billId === 'string' ? r.billId.trim() : '';
            const amt = Number(r.amount);
            if (!billId || !Number.isFinite(amt) || amt <= 0) return null;
            return { billId, amount: amt };
          })
          .filter((r): r is CrmBillApplication => r !== null);
      }
    } catch {
      // fall through to flat-key parsing
    }
  }
  const out: CrmBillApplication[] = [];
  for (let i = 0; i < 50; i++) {
    const billId = formData.get(`applyTo[${i}].billId`);
    const amt = formData.get(`applyTo[${i}].amount`);
    if (typeof billId !== 'string' || !billId.trim()) continue;
    const n = typeof amt === 'string' ? Number(amt) : NaN;
    if (!Number.isFinite(n) || n <= 0) continue;
    out.push({ billId: billId.trim(), amount: n });
  }
  return out;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. The Rust PATCH handler accepts every field as optional, so the
 * edit flow can amend any column.
 *
 * Multi-bill allocation: serialize as `applyTo` (JSON blob) on the form
 * side; this action reads it via `parseApplyTo`.
 */
export async function savePayoutAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const paymentNo = pickString(formData, 'paymentNo');
  const date = pickString(formData, 'date');
  const vendorId = pickString(formData, 'vendorId');
  const modeRaw = pickString(formData, 'mode');
  const bankAccountId = pickString(formData, 'bankAccountId');
  let amount = pickNumber(formData, 'amount');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const applyTo = parseApplyTo(formData);
  // If amount wasn't supplied but apply-rows are, fall back to the
  // summed allocation.
  if ((amount == null || amount <= 0) && applyTo.length > 0) {
    amount = applyTo.reduce((s, r) => s + r.amount, 0);
  }
  const excessAsAdvanceRaw = pickString(formData, 'excessAsAdvance');
  const excessAsAdvance =
    excessAsAdvanceRaw === 'true' || excessAsAdvanceRaw === 'on';

  try {
    let result: CrmPayoutDoc;
    if (id) {
      const patch: CrmPayoutUpdateInput = {
        paymentNo,
        date,
        vendorId,
        mode: asMode(modeRaw),
        bankAccountId,
        chequeNo: pickString(formData, 'chequeNo'),
        chequeDate: pickString(formData, 'chequeDate'),
        txnId: pickString(formData, 'txnId'),
        reference: pickString(formData, 'reference'),
        amount,
        currency,
        applyTo: applyTo.length > 0 ? applyTo : undefined,
        excessAsAdvance: excessAsAdvanceRaw ? excessAsAdvance : undefined,
        tdsDeducted: pickNumber(formData, 'tdsDeducted'),
        notes: pickString(formData, 'notes'),
        status: asStatus(pickString(formData, 'status')),
      };
      result = await crmPayoutsApi.update(id, patch);
    } else {
      if (!paymentNo) return { error: 'Payout number is required.' };
      if (!date) return { error: 'Date is required.' };
      if (!vendorId) return { error: 'Vendor is required.' };
      if (!bankAccountId) return { error: 'Bank account is required.' };
      const mode = asMode(modeRaw);
      if (!mode) return { error: 'Payment method is required.' };
      if (typeof amount !== 'number' || amount <= 0) {
        return { error: 'Amount must be greater than zero.' };
      }

      const draft: CrmPayoutCreateInput = {
        paymentNo,
        date,
        vendorId,
        mode,
        bankAccountId,
        amount,
        currency,
        chequeNo: pickString(formData, 'chequeNo'),
        chequeDate: pickString(formData, 'chequeDate'),
        txnId: pickString(formData, 'txnId'),
        reference: pickString(formData, 'reference'),
        applyTo: applyTo.length > 0 ? applyTo : undefined,
        tdsDeducted: pickNumber(formData, 'tdsDeducted'),
        notes: pickString(formData, 'notes'),
        excessAsAdvance,
      };
      result = await crmPayoutsApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Payout updated.' : 'Payout created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a payout. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deletePayoutAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing payout id.' };
  try {
    await crmPayoutsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Payout not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmPayoutsApi.x(...)`.

export async function createPayout(input: CrmPayoutCreateInput) {
  return crmPayoutsApi.create(input);
}

export async function updatePayout(id: string, patch: CrmPayoutUpdateInput) {
  return crmPayoutsApi.update(id, patch);
}

export async function deletePayout(id: string) {
  return crmPayoutsApi.delete(id);
}

/* ─── KPIs ────────────────────────────────────────────────────── */

interface PayoutKpis {
  paidThisMonthTotal: number;
  paidThisMonthCount: number;
  clearedCount: number;
  failedCount: number;
  pendingCount: number;
  currency: string;
}

const EMPTY_PAYOUT_KPIS: PayoutKpis = {
  paidThisMonthTotal: 0,
  paidThisMonthCount: 0,
  clearedCount: 0,
  failedCount: 0,
  pendingCount: 0,
  currency: 'INR',
};

/**
 * Derive payout KPIs from a wide page. The Rust BFF doesn't expose
 * an aggregate endpoint yet — compute on the server from the first
 * 100 rows. Mirrors the receipts KPI shape, swapping
 * `bounced` → `failed` and adding a `pending` bucket (status='sent').
 */
export async function getPayoutKpis(): Promise<PayoutKpis> {
  try {
    const rows = await crmPayoutsApi.list({ page: 1, limit: 100 });
    if (!Array.isArray(rows) || rows.length === 0) return EMPTY_PAYOUT_KPIS;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let paidThisMonthTotal = 0;
    let paidThisMonthCount = 0;
    let clearedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let currency = 'INR';
    for (const p of rows) {
      currency = p.currency || currency;
      const dt = p.date ? new Date(p.date) : null;
      if (dt && !isNaN(dt.getTime()) && dt >= monthStart) {
        paidThisMonthTotal += Number(p.amount) || 0;
        paidThisMonthCount += 1;
      }
      const status = (p.status || 'sent').toLowerCase();
      if (status === 'cleared') clearedCount += 1;
      else if (status === 'failed') failedCount += 1;
      else pendingCount += 1; // 'sent' or anything else not cleared/failed
    }
    return {
      paidThisMonthTotal,
      paidThisMonthCount,
      clearedCount,
      failedCount,
      pendingCount,
      currency,
    };
  } catch {
    return EMPTY_PAYOUT_KPIS;
  }
}

/* ─── Inline status / bulk mutators ───────────────────────────── */

function isPayoutStatus(s: string): s is CrmPayoutStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(s);
}

/** Mark a single payout with a new workflow status. */
export async function setPayoutStatus(
  id: string,
  status: CrmPayoutStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing payout id.' };
  if (!isPayoutStatus(status)) {
    return { success: false, error: 'Invalid status.' };
  }
  try {
    await crmPayoutsApi.update(id, { status });
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

/** Run a bulk operation across many payouts. */
export async function bulkPayoutAction(
  ids: string[],
  op: 'archive' | 'delete' | 'status',
  payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No payouts selected.' };
  }
  try {
    let processed = 0;
    for (const id of ids) {
      try {
        if (op === 'delete') {
          await crmPayoutsApi.delete(id);
        } else if (op === 'status') {
          const s = (payload ?? '').toLowerCase();
          if (!isPayoutStatus(s)) continue;
          await crmPayoutsApi.update(id, { status: s });
        } else if (op === 'archive') {
          // No `archived` flag on the Rust patch — best-effort: prefix
          // notes with [archived] so it survives a re-read.
          // TODO 1D.x: surface a first-class archived flag once the
          // Rust DTO grows one.
          await crmPayoutsApi.update(id, { notes: '[archived]' });
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

/* ─── Helpers for the form's multi-bill apply picker ──────────── */

interface UnpaidBillRow {
  _id: string;
  billNo?: string;
  total: number;
  paid: number;
  balance: number;
  currency?: string;
  status?: string;
  billDate?: string;
}

/**
 * Fetch a vendor's open bills (anything with `balance > 0` and not
 * fully paid) for the payout apply-row picker. Mirrors
 * `getUnpaidInvoicesByAccount` on the customer side.
 */
export async function getUnpaidBillsByVendor(
  vendorId: string,
): Promise<UnpaidBillRow[]> {
  if (!vendorId) return [];
  try {
    const bills = await crmBillsApi.list({ vendorId, page: 1, limit: 50 });
    if (!Array.isArray(bills)) return [];
    return bills
      .map((b) => {
        const total = Number(b.totals?.total) || 0;
        const paid = Number(b.amountPaid) || 0;
        const balance = Number.isFinite(b.balance)
          ? Number(b.balance)
          : Math.max(0, total - paid);
        return {
          _id: String(b._id),
          billNo: b.billNo,
          total,
          paid,
          balance,
          currency: b.currency,
          status: typeof b.status === 'string' ? b.status : undefined,
          billDate: b.billDate,
        };
      })
      .filter((b) => b.balance > 0);
  } catch {
    return [];
  }
}
