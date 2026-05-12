'use server';

/**
 * CRM Bill (expense) server actions.
 *
 * Thin shims over the Rust BFF (`crmBillsApi`). No direct Mongo access.
 * FormData callers (the new/edit pages) hit `saveBillAction` /
 * `deleteBillAction`; programmatic callers can use the typed helpers
 * (`listBills`, `getBill`, `createBill`, `updateBill`, `deleteBill`).
 *
 * The Rust crate calls these "bills" (vendor invoices, buy-side); the
 * user-facing route is `/dashboard/crm/purchases/expenses/` for legacy
 * URL stability — bills ARE expenses in the AP sense, and the
 * `WsCustomFieldBelongsTo` value for this entity is `'expense'`.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmBillsApi,
  type CrmBillCreateInput,
  type CrmBillDoc,
  type CrmBillLineItem,
  type CrmBillListParams,
  type CrmBillTotals,
  type CrmBillUpdateInput,
} from '@/lib/rust-client/crm-bills';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';

const LIST_PATH = '/dashboard/crm/purchases/expenses';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface BillListResult {
  bills: CrmBillDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listBills(params: CrmBillListParams = {}): Promise<BillListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const bills = await crmBillsApi.list({ ...params, page, limit });
    return { bills, page, limit, hasMore: bills.length === limit };
  } catch (e) {
    return { bills: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getBill(
  id: string,
): Promise<{ bill: CrmBillDoc | null; error?: string }> {
  if (!id) return { bill: null, error: 'Missing bill id.' };
  try {
    const bill = await crmBillsApi.getById(id);
    return { bill };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { bill: null, error: 'Bill not found.' };
    }
    return { bill: null, error: rustErr(e) };
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
  if (typeof v !== 'string') return undefined;
  if (v === 'true' || v === 'on' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

function parseCustomFields(formData: FormData): Record<string, unknown> | null {
  const raw = formData.get('customFields');
  if (typeof raw !== 'string' || raw.length === 0 || raw === '{}') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Parse the JSON-encoded `lineItems` blob from the form. Each row is
 * normalized into a `CrmBillLineItem` — strings get coerced to
 * numbers, blanks are dropped, and the per-line `total` is recomputed
 * (qty × rate) so the wire payload is internally consistent regardless
 * of any client-side rounding skew.
 */
function parseLineItems(formData: FormData): CrmBillLineItem[] {
  const raw = formData.get('lineItems');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: CrmBillLineItem[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const qty = Number(r.qty ?? 0);
    const rate = Number(r.rate ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) continue;
    const item: CrmBillLineItem = {
      qty,
      rate,
      total: Number(r.total ?? qty * rate) || qty * rate,
    };
    if (typeof r.itemId === 'string' && r.itemId) item.itemId = r.itemId;
    if (typeof r.description === 'string' && r.description) item.description = r.description;
    if (typeof r.hsnSac === 'string' && r.hsnSac) item.hsnSac = r.hsnSac;
    if (typeof r.unit === 'string' && r.unit) item.unit = r.unit;
    const dp = Number(r.discountPct);
    if (Number.isFinite(dp)) item.discountPct = dp;
    const tp = Number(r.taxRatePct);
    if (Number.isFinite(tp)) item.taxRatePct = tp;
    out.push(item);
  }
  return out;
}

/**
 * Derive document-level totals from a normalized line-item array. The
 * UI computes these client-side for the preview pane, but we recompute
 * here so server-side state is the source of truth on save.
 */
function deriveTotals(items: CrmBillLineItem[]): CrmBillTotals {
  const subTotal = items.reduce((s, li) => s + (li.total ?? li.qty * li.rate), 0);
  return { subTotal, total: subTotal };
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Custom-field values (under the `customFields` JSON blob) are
 * persisted via `applyCustomFieldsToEntity` after the main row is
 * created/updated — failures there are logged but do not roll back the
 * bill save.
 */
export async function saveBillAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const vendorId = pickString(formData, 'vendorId');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const billDateStr = pickString(formData, 'billDate');
  const dueDateStr = pickString(formData, 'dueDate');

  if (!vendorId) {
    return { error: 'Vendor is required.' };
  }
  if (!billDateStr) {
    return { error: 'Bill date is required.' };
  }

  const billDate = new Date(billDateStr);
  if (isNaN(billDate.getTime())) {
    return { error: 'Bill date must be a valid date.' };
  }
  let dueDate: Date | undefined;
  if (dueDateStr) {
    dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) {
      return { error: 'Due date must be a valid date.' };
    }
  }

  const items = parseLineItems(formData);
  if (items.length === 0) {
    return { error: 'At least one line item is required.' };
  }
  const totals = deriveTotals(items);

  const draft: CrmBillCreateInput = {
    billNo: pickString(formData, 'billNo'),
    vendorInvoiceNo: pickString(formData, 'vendorInvoiceNo'),
    billDate: billDate.toISOString(),
    dueDate: dueDate ? dueDate.toISOString() : undefined,
    vendorId,
    items,
    tdsSection: pickString(formData, 'tdsSection'),
    tdsAmount: pickNumber(formData, 'tdsAmount'),
    reverseCharge: pickBool(formData, 'reverseCharge'),
    placeOfSupply: pickString(formData, 'placeOfSupply'),
    currency,
    totals,
    notes: pickString(formData, 'notes'),
  };

  try {
    let result: CrmBillDoc;
    if (id) {
      const patch: CrmBillUpdateInput = {
        vendorInvoiceNo: draft.vendorInvoiceNo,
        billDate: draft.billDate,
        dueDate: draft.dueDate,
        vendorId: draft.vendorId,
        items: draft.items,
        tdsSection: draft.tdsSection,
        tdsAmount: draft.tdsAmount,
        reverseCharge: draft.reverseCharge,
        placeOfSupply: draft.placeOfSupply,
        currency: draft.currency,
        totals: draft.totals,
        notes: draft.notes,
        status: pickString(formData, 'status'),
      };
      result = await crmBillsApi.update(id, patch);
    } else {
      result = await crmBillsApi.create(draft);
    }

    const cfValues = parseCustomFields(formData);
    if (cfValues && result._id) {
      try {
        await applyCustomFieldsToEntity('expense', String(result._id), cfValues);
      } catch (e) {
        console.error('[saveBillAction] custom fields apply failed:', e);
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Bill updated.' : 'Bill created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a bill. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteBillAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing bill id.' };
  try {
    await crmBillsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Bill not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createBill(input: CrmBillCreateInput) {
  return crmBillsApi.create(input);
}

export async function updateBill(id: string, patch: CrmBillUpdateInput) {
  return crmBillsApi.update(id, patch);
}

export async function deleteBill(id: string) {
  return crmBillsApi.delete(id);
}
