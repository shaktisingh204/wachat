'use server';

/**
 * CRM Bill (expense) server actions.
 *
 * Thin shims over the Rust BFF (`crmBillsApi`). No direct Mongo access
 * for the core CRUD path. FormData callers (the new/edit pages) hit
 * `saveBillAction` / `deleteBillAction`; programmatic callers can use
 * the typed helpers (`listBills`, `getBill`, `createBill`, `updateBill`,
 * `deleteBill`).
 *
 * §1D additions (Bills rebuild — mirrors invoices.actions.ts):
 *  - `computeBillKpis()` — list-page KPI strip aggregate.
 *  - `getCrmBillRelatedCounts()` — right-rail counts.
 *  - `bulkArchiveBills / bulkDeleteBills / bulkChangeBillStatus` —
 *    list bulk-bar wiring.
 *  - `patchBill` / `updateBillStatus` — detail-page quick-edits.
 *
 * The Rust crate calls these "bills" (vendor invoices, buy-side); the
 * user-facing route is `/dashboard/crm/purchases/expenses/` for legacy
 * URL stability — bills ARE expenses in the AP sense, and the
 * `WsCustomFieldBelongsTo` value for this entity is `'expense'`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { RustApiError } from '@/lib/rust-client';
import {
  crmBillsApi,
  type CrmBillCreateInput,
  type CrmBillDoc,
  type CrmBillExpenseLine,
  type CrmBillLineItem,
  type CrmBillListParams,
  type CrmBillStatus,
  type CrmBillTotals,
  type CrmBillUpdateInput,
} from '@/lib/rust-client/crm-bills';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';

const LIST_PATH = '/dashboard/crm/purchases/expenses';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function revalidateSurfaces(billId?: string): void {
  revalidatePath(LIST_PATH);
  if (billId) {
    revalidatePath(`${LIST_PATH}/${billId}`);
    revalidatePath(`${LIST_PATH}/${billId}/edit`);
    revalidatePath(`${LIST_PATH}/${billId}/activity`);
  }
}

/* ─── Read ────────────────────────────────────────────────────── */

interface BillListResult {
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
  const session = await getSession();
  if (!session?.user) {
    return { bills: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_bill', 'view');
  if (!guard.ok) {
    return { bills: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const bills = await crmBillsApi.list({ ...params, page, limit });
    return { bills, page, limit, hasMore: bills.length === limit };
  } catch (e) {
    console.error('[listBills] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'bill', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { bills: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getBill(
  id: string,
): Promise<{ bill: CrmBillDoc | null; error?: string }> {
  if (!id) return { bill: null, error: 'Missing bill id.' };
  const session = await getSession();
  if (!session?.user) {
    return { bill: null, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_bill', 'view');
  if (!guard.ok) {
    return { bill: null, error: guard.error };
  }
  try {
    const bill = await crmBillsApi.getById(id);
    return { bill };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { bill: null, error: 'Bill not found.' };
    }
    console.error('[getBill] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'bill', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
 * Parse the JSON-encoded `expenseLines` blob from the form (direct-to-
 * ledger expense rows like rent, utilities). Each row has `accountId +
 * amount + tax + project + description`; we coerce numerics and drop
 * malformed rows quietly.
 */
function parseExpenseLines(formData: FormData): CrmBillExpenseLine[] {
  const raw = formData.get('expenseLines');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CrmBillExpenseLine[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const amount = Number(r.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const item: CrmBillExpenseLine = { amount };
    if (typeof r.accountId === 'string' && r.accountId) item.accountId = r.accountId;
    if (typeof r.description === 'string' && r.description)
      item.description = r.description;
    const tp = Number(r.taxRatePct);
    if (Number.isFinite(tp)) item.taxRatePct = tp;
    out.push(item);
  }
  return out;
}

/**
 * Derive document-level totals from a normalized line/expense-line array.
 * The UI computes these client-side for the preview pane, but we recompute
 * here so server-side state is the source of truth on save.
 */
function deriveTotals(
  items: CrmBillLineItem[],
  expenseLines: CrmBillExpenseLine[] = [],
): CrmBillTotals {
  const itemsSub = items.reduce(
    (s, li) => s + (li.total ?? li.qty * li.rate),
    0,
  );
  const expensesSub = expenseLines.reduce((s, el) => s + (el.amount || 0), 0);
  const subTotal = itemsSub + expensesSub;
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
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_bill', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };
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
  const expenseLines = parseExpenseLines(formData);
  if (items.length === 0 && expenseLines.length === 0) {
    return { error: 'At least one line item or expense line is required.' };
  }
  const totals = deriveTotals(items, expenseLines);

  const fromKindRaw = pickString(formData, 'fromKind');
  const fromIdRaw = pickString(formData, 'fromId');

  const draft: CrmBillCreateInput = {
    billNo: pickString(formData, 'billNo'),
    vendorInvoiceNo: pickString(formData, 'vendorInvoiceNo'),
    billDate: billDate.toISOString(),
    dueDate: dueDate ? dueDate.toISOString() : undefined,
    vendorId,
    items,
    expenseLines: expenseLines.length ? expenseLines : undefined,
    tdsSection: pickString(formData, 'tdsSection'),
    tdsAmount: pickNumber(formData, 'tdsAmount'),
    reverseCharge: pickBool(formData, 'reverseCharge'),
    placeOfSupply: pickString(formData, 'placeOfSupply'),
    currency,
    totals,
    notes: pickString(formData, 'notes'),
    ...(fromKindRaw === 'purchaseOrder' || fromKindRaw === 'grn'
      ? { fromKind: fromKindRaw, fromId: fromIdRaw }
      : {}),
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
        expenseLines: draft.expenseLines,
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

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'bill',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidateSurfaces(String(result._id));
    return {
      message: id ? 'Bill updated.' : 'Bill created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveBillAction] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'bill',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
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
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_bill', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmBillsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'bill',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Bill not found.' };
    }
    console.error('[deleteBillAction] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'bill',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
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

/* ─── §1D additions ───────────────────────────────────────────── */

// `computeBillKpis` / `BillKpiSummary` live in `./bills.kpis.ts` — pure
// helpers can't be exported from a `'use server'` module.

/**
 * Live related-entity counts for the detail page right rail. Reads
 * directly from Mongo (the Rust BFF doesn't expose a count endpoint).
 */
export async function getCrmBillRelatedCounts(billId: string): Promise<{
  payouts: number;
  debitNotes: number;
  purchaseOrders: number;
  grns: number;
}> {
  const empty = { payouts: 0, debitNotes: 0, purchaseOrders: 0, grns: 0 };
  if (!billId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [billId];
    if (ObjectId.isValid(billId)) idCandidates.push(new ObjectId(billId));

    const [payouts, debitNotes, purchaseOrders, grns] = await Promise.all([
      db
        .collection('crm_payouts')
        .countDocuments({
          userId,
          $or: [
            { billId: { $in: idCandidates } },
            { 'allocations.billId': { $in: idCandidates } },
            { 'lineage.id': billId, 'lineage.kind': 'bill' },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_debit_notes')
        .countDocuments({
          userId,
          $or: [
            { billId: { $in: idCandidates } },
            { 'lineage.id': billId, 'lineage.kind': 'bill' },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_purchase_orders')
        .countDocuments({
          userId,
          'lineage.id': billId,
          'lineage.kind': 'bill',
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_grns')
        .countDocuments({
          userId,
          'lineage.id': billId,
          'lineage.kind': 'bill',
        } as Record<string, unknown>)
        .catch(() => 0),
    ]);

    return {
      payouts: Number(payouts) || 0,
      debitNotes: Number(debitNotes) || 0,
      purchaseOrders: Number(purchaseOrders) || 0,
      grns: Number(grns) || 0,
    };
  } catch (e) {
    console.error('[getCrmBillRelatedCounts] failed:', e);
    return empty;
  }
}

/* ─── Bulk ops ────────────────────────────────────────────────── */

async function auditMany(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  ids: string[],
  action: string,
  reason?: string,
): Promise<void> {
  for (const id of ids) {
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action,
        entityKind: 'bill',
        entityId: id,
        reason,
      });
    } catch {
      /* non-fatal */
    }
  }
}

export async function bulkDeleteBills(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const guard = await requirePermission('crm_bill', 'delete');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  const valid = (ids ?? []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No bills selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmBillsApi.delete(id);
        processed += 1;
      } catch (e) {
        console.error('[bulkDeleteBills] per-row failure:', e);
        recordRustFallback({
          entity: 'bill',
          op: 'delete',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await auditMany(session, valid, 'delete', 'bulk:delete');
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkArchiveBills(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const guard = await requirePermission('crm_bill', 'edit');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  const valid = (ids ?? []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No bills selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmBillsApi.update(id, { status: 'cancelled' });
        processed += 1;
      } catch (e) {
        console.error('[bulkArchiveBills] per-row failure:', e);
        recordRustFallback({
          entity: 'bill',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await auditMany(session, valid, 'archive', 'bulk:archive');
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkChangeBillStatus(
  ids: string[],
  status: CrmBillStatus | string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const guard = await requirePermission('crm_bill', 'edit');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  const valid = (ids ?? []).filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No bills selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmBillsApi.update(id, { status });
        processed += 1;
      } catch (e) {
        console.error('[bulkChangeBillStatus] per-row failure:', e);
        recordRustFallback({
          entity: 'bill',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await auditMany(session, valid, 'status_change', `bulk:status=${status}`);
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

/* ─── Detail-page quick edits ─────────────────────────────────── */

export async function updateBillStatus(
  id: string,
  status: CrmBillStatus | string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing bill id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_bill', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmBillsApi.update(id, { status });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'bill',
        entityId: id,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    console.error('[updateBillStatus] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'bill',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/**
 * Generic patch helper for detail-page quick-edit chips (vendor change,
 * currency change, due date reschedule...). Pass any subset of the
 * canonical update shape.
 */
export async function patchBill(
  id: string,
  patch: CrmBillUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing bill id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_bill', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmBillsApi.update(id, patch);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'bill',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    console.error('[patchBill] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'bill',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}
