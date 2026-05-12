'use server';

/**
 * CRM Payout server actions.
 *
 * Thin shims over the Rust BFF (`crmPayoutsApi`). No direct Mongo
 * access. FormData callers (the create/edit form) hit
 * `savePayoutAction` / `deletePayoutAction`; programmatic callers can
 * use the typed helpers (`listPayouts`, `getPayout`, etc.).
 *
 * Note: `'payout'` is NOT in `WsCustomFieldBelongsTo`, so this action
 * layer deliberately skips custom-fields plumbing.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmPayoutsApi,
  type CrmPayoutCreateInput,
  type CrmPayoutDoc,
  type CrmPayoutListParams,
  type CrmPayoutMode,
  type CrmPayoutStatus,
  type CrmPayoutUpdateInput,
} from '@/lib/rust-client/crm-payouts';

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

export interface PayoutListResult {
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
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. The Rust PATCH handler accepts every field as optional, so the
 * edit flow can amend any column.
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
  const amount = pickNumber(formData, 'amount');
  const currency = pickString(formData, 'currency') ?? 'INR';

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
        tdsDeducted: pickNumber(formData, 'tdsDeducted'),
        notes: pickString(formData, 'notes'),
        excessAsAdvance: false,
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
