'use server';

/**
 * CRM Invoice server actions.
 *
 * Thin shims over the Rust BFF (`crmInvoicesApi`). No direct Mongo access.
 * FormData callers (the new/edit pages) hit `saveInvoiceAction` /
 * `deleteInvoiceAction`; programmatic callers can use the typed helpers
 * (`listInvoices`, `getInvoice`, `createInvoice`, `updateInvoice`,
 * `deleteInvoice`).
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmInvoicesApi,
  type CrmInvoiceCreateInput,
  type CrmInvoiceDoc,
  type CrmInvoiceLineItem,
  type CrmInvoiceListParams,
  type CrmInvoiceTotals,
  type CrmInvoiceUpdateInput,
} from '@/lib/rust-client/crm-invoices';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';

const LIST_PATH = '/dashboard/crm/sales/invoices';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface InvoiceListResult {
  invoices: CrmInvoiceDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listInvoices(
  params: CrmInvoiceListParams = {},
): Promise<InvoiceListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const invoices = await crmInvoicesApi.list({ ...params, page, limit });
    return { invoices, page, limit, hasMore: invoices.length === limit };
  } catch (e) {
    return { invoices: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getInvoice(
  id: string,
): Promise<{ invoice: CrmInvoiceDoc | null; error?: string }> {
  if (!id) return { invoice: null, error: 'Missing invoice id.' };
  try {
    const invoice = await crmInvoicesApi.getById(id);
    return { invoice };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { invoice: null, error: 'Invoice not found.' };
    }
    return { invoice: null, error: rustErr(e) };
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
 * normalized into a `CrmInvoiceLineItem` — strings get coerced to
 * numbers, blanks are dropped, and the per-line `total` is recomputed
 * (qty × rate) so the wire payload is internally consistent regardless
 * of any client-side rounding skew.
 */
function parseLineItems(formData: FormData): CrmInvoiceLineItem[] {
  const raw = formData.get('lineItems');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: CrmInvoiceLineItem[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const qty = Number(r.qty ?? 0);
    const rate = Number(r.rate ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) continue;
    const item: CrmInvoiceLineItem = {
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
function deriveTotals(items: CrmInvoiceLineItem[]): CrmInvoiceTotals {
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
 * invoice save.
 */
export async function saveInvoiceAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const invoiceNo = pickString(formData, 'invoiceNo');
  const clientId = pickString(formData, 'clientId');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const dateStr = pickString(formData, 'date');
  const dueDateStr = pickString(formData, 'dueDate');

  if (!invoiceNo) {
    return { error: 'Invoice number is required.' };
  }
  if (!clientId) {
    return { error: 'Customer is required.' };
  }
  if (!dateStr) {
    return { error: 'Invoice date is required.' };
  }
  if (!dueDateStr) {
    return { error: 'Due date is required.' };
  }

  const date = new Date(dateStr);
  const dueDate = new Date(dueDateStr);
  if (isNaN(date.getTime()) || isNaN(dueDate.getTime())) {
    return { error: 'Date and due date must be valid dates.' };
  }

  const items = parseLineItems(formData);
  if (items.length === 0) {
    return { error: 'At least one line item is required.' };
  }
  const totals = deriveTotals(items);

  const draft: CrmInvoiceCreateInput = {
    invoiceNo,
    date: date.toISOString(),
    dueDate: dueDate.toISOString(),
    clientId,
    placeOfSupply: pickString(formData, 'placeOfSupply'),
    currency,
    items,
    totals,
    tcsPct: pickNumber(formData, 'tcsPct'),
    tdsPct: pickNumber(formData, 'tdsPct'),
    paymentTerms: pickString(formData, 'paymentTerms'),
    customerNotes: pickString(formData, 'customerNotes'),
    termsAndConditions: pickString(formData, 'termsAndConditions'),
  };

  try {
    let result: CrmInvoiceDoc;
    if (id) {
      const patch: CrmInvoiceUpdateInput = {
        ...draft,
        status: pickString(formData, 'status'),
      };
      result = await crmInvoicesApi.update(id, patch);
    } else {
      result = await crmInvoicesApi.create(draft);
    }

    const cfValues = parseCustomFields(formData);
    if (cfValues && result._id) {
      try {
        await applyCustomFieldsToEntity('invoice', String(result._id), cfValues);
      } catch (e) {
        console.error('[saveInvoiceAction] custom fields apply failed:', e);
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Invoice updated.' : 'Invoice created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete an invoice. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteInvoiceAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing invoice id.' };
  try {
    await crmInvoicesApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Invoice not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createInvoice(input: CrmInvoiceCreateInput) {
  return crmInvoicesApi.create(input);
}

export async function updateInvoice(id: string, patch: CrmInvoiceUpdateInput) {
  return crmInvoicesApi.update(id, patch);
}

export async function deleteInvoice(id: string) {
  return crmInvoicesApi.delete(id);
}
