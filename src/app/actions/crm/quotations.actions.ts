'use server';

/**
 * CRM Quotation server actions.
 *
 * Thin shims over the Rust BFF (`crmQuotationsApi`). No direct Mongo
 * access. FormData callers (the create/edit form, list page) hit
 * `saveQuotationAction` / `deleteQuotationAction`; programmatic
 * callers can use the typed helpers (`listQuotations`, `getQuotation`,
 * `createQuotation`, `updateQuotation`, `deleteQuotation`).
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmQuotationsApi,
  type CrmQuotationCreateInput,
  type CrmQuotationDoc,
  type CrmQuotationLineItem,
  type CrmQuotationListParams,
  type CrmQuotationUpdateInput,
} from '@/lib/rust-client/crm-quotations';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';

const LIST_PATH = '/dashboard/crm/sales/quotations';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface QuotationListResult {
  quotations: CrmQuotationDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listQuotations(
  params: CrmQuotationListParams = {},
): Promise<QuotationListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const quotations = await crmQuotationsApi.list({ ...params, page, limit });
    return { quotations, page, limit, hasMore: quotations.length === limit };
  } catch (e) {
    return { quotations: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getQuotation(
  id: string,
): Promise<{ quotation: CrmQuotationDoc | null; error?: string }> {
  if (!id) return { quotation: null, error: 'Missing quotation id.' };
  try {
    const quotation = await crmQuotationsApi.getById(id);
    return { quotation };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { quotation: null, error: 'Quotation not found.' };
    }
    return { quotation: null, error: rustErr(e) };
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
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Coerce a yyyy-mm-dd / ISO string from the form into a full ISO-8601
 * timestamp the Rust handler accepts. Returns `undefined` when the
 * value is blank or unparseable so PATCH callers can omit the field.
 */
function toIsoOrUndefined(v?: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Parse the `items` JSON blob written by the form into the wire shape
 * the Rust DTO expects. Tolerant of partially-filled rows — strips
 * blanks and coerces numbers — so the form can offer a "blank row"
 * placeholder without forcing the user to delete it before submit.
 */
function parseLineItems(formData: FormData): CrmQuotationLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: CrmQuotationLineItem[] = [];
  for (const rawItem of parsed) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const row = rawItem as Record<string, unknown>;
    const qty = Number(row.qty);
    const rate = Number(row.rate);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) continue;
    // Skip wholly-empty placeholder rows.
    const descriptionRaw = typeof row.description === 'string' ? row.description.trim() : '';
    const itemId = typeof row.itemId === 'string' && row.itemId.trim() ? row.itemId.trim() : undefined;
    if (!itemId && !descriptionRaw && qty === 0 && rate === 0) continue;
    const discountPct = Number(row.discountPct);
    const taxRatePct = Number(row.taxRatePct);
    const subTotal = qty * rate;
    const lineTotal = Number.isFinite(Number(row.total))
      ? Number(row.total)
      : subTotal +
        (Number.isFinite(taxRatePct) ? (subTotal * taxRatePct) / 100 : 0);
    items.push({
      itemId,
      description: descriptionRaw || undefined,
      hsnSac: typeof row.hsnSac === 'string' && row.hsnSac.trim() ? row.hsnSac.trim() : undefined,
      qty,
      unit: typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim() : undefined,
      rate,
      discountPct: Number.isFinite(discountPct) ? discountPct : undefined,
      taxRatePct: Number.isFinite(taxRatePct) ? taxRatePct : undefined,
      total: lineTotal,
    });
  }
  return items;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Custom-field values (under the `customFields` JSON blob) are
 * persisted via `applyCustomFieldsToEntity` after the main row is
 * created/updated — failures there are logged but do not roll back the
 * quotation save.
 */
export async function saveQuotationAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const quotationNo = pickString(formData, 'quotationNo');
  const clientId = pickString(formData, 'clientId');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const date = toIsoOrUndefined(pickString(formData, 'date'));
  const validUntil = toIsoOrUndefined(pickString(formData, 'validUntil'));
  const items = parseLineItems(formData);

  if (!id) {
    if (!quotationNo) return { error: 'Quotation number is required.' };
    if (!clientId) return { error: 'Client is required.' };
    if (!date) return { error: 'Quotation date is required.' };
    if (!validUntil) return { error: 'Valid-until date is required.' };
    if (items.length === 0) return { error: 'At least one line item is required.' };
  }

  try {
    let result: CrmQuotationDoc;
    if (id) {
      const patch: CrmQuotationUpdateInput = {
        quotationNo,
        clientId,
        currency,
        date,
        validUntil,
        placeOfSupply: pickString(formData, 'placeOfSupply'),
        subject: pickString(formData, 'subject'),
        termsAndConditions: pickString(formData, 'termsAndConditions'),
        notes: pickString(formData, 'notes'),
        status: pickString(formData, 'status'),
        items: items.length > 0 ? items : undefined,
      };
      result = await crmQuotationsApi.update(id, patch);
    } else {
      const draft: CrmQuotationCreateInput = {
        quotationNo: quotationNo!,
        clientId: clientId!,
        currency,
        date: date!,
        validUntil: validUntil!,
        placeOfSupply: pickString(formData, 'placeOfSupply'),
        subject: pickString(formData, 'subject'),
        termsAndConditions: pickString(formData, 'termsAndConditions'),
        notes: pickString(formData, 'notes'),
        items,
        fromKind: pickString(formData, 'fromKind') as 'lead' | 'deal' | undefined,
        fromId: pickString(formData, 'fromId'),
      };
      // Strip optional fromKind when blank so the Rust DTO doesn't see
      // an empty string and try to seed lineage.
      if (!draft.fromKind || !draft.fromId) {
        delete draft.fromKind;
        delete draft.fromId;
      }
      result = await crmQuotationsApi.create(draft);
    }

    const cfValues = parseCustomFields(formData);
    if (cfValues && result._id) {
      try {
        await applyCustomFieldsToEntity('quotation', String(result._id), cfValues);
      } catch (e) {
        console.error('[saveQuotationAction] custom fields apply failed:', e);
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Quotation updated.' : 'Quotation created.',
      id: String(result._id),
    };
  } catch (e) {
    // Number/finance fields aren't pulled out separately — the picker
    // helper above is unused at submit time but kept available for
    // future inline-totals workflows that need it.
    void pickNumber;
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a quotation. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteQuotationAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing quotation id.' };
  try {
    await crmQuotationsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Quotation not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createQuotation(input: CrmQuotationCreateInput) {
  return crmQuotationsApi.create(input);
}

export async function updateQuotation(
  id: string,
  patch: CrmQuotationUpdateInput,
) {
  return crmQuotationsApi.update(id, patch);
}

export async function deleteQuotation(id: string) {
  return crmQuotationsApi.delete(id);
}
