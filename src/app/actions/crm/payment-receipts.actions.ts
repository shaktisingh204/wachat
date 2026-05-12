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
  type CrmPaymentMode,
  type CrmPaymentReceiptCreateInput,
  type CrmPaymentReceiptDoc,
  type CrmPaymentReceiptListParams,
  type CrmPaymentReceiptUpdateInput,
  type CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';

const LIST_PATH = '/dashboard/crm/sales/payments';

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

      const draft: CrmPaymentReceiptCreateInput = {
        receiptNo,
        date,
        clientId,
        mode,
        bankAccountId,
        amount,
        currency,
        chequeNo: pickString(formData, 'chequeNo'),
        chequeDate: pickString(formData, 'chequeDate'),
        txnId: pickString(formData, 'txnId'),
        reference: pickString(formData, 'reference'),
        tdsDeducted: pickNumber(formData, 'tdsDeducted'),
        bankCharges: pickNumber(formData, 'bankCharges'),
        notes: pickString(formData, 'notes'),
        excessAsAdvance: false,
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
