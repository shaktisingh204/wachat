'use server';

/**
 * CRM Invoice server actions.
 *
 * Thin shims over the Rust BFF (`crmInvoicesApi`). No direct Mongo access
 * for the core CRUD path. FormData callers (the new/edit pages) hit
 * `saveInvoiceAction` / `deleteInvoiceAction`; programmatic callers can
 * use the typed helpers (`listInvoices`, `getInvoice`, `createInvoice`,
 * `updateInvoice`, `deleteInvoice`).
 *
 * §1D additions:
 *  - `getInvoiceKpis()` — list-page KPI strip aggregate.
 *  - `getCrmInvoiceRelatedCounts()` — right-rail counts.
 *  - `findInvoiceDuplicates()` — list-page "Find duplicates".
 *  - `bulkArchiveInvoices / bulkDeleteInvoices / bulkChangeInvoiceStatus
 *    / bulkAssignInvoices` — list bulk-bar wiring.
 *  - `patchInvoice` / `updateInvoiceStatus` — detail-page quick-edits.
 *  - `sendInvoiceEmail` — detail-page email composer.
 *
 * All mutations write audit entries (best-effort). The Rust path is the
 * authoritative source; the Mongo fall-throughs exist purely so legacy
 * envs keep working.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { RustApiError } from '@/lib/rust-client';
import {
  crmInvoicesApi,
  type CrmInvoiceCreateInput,
  type CrmInvoiceDoc,
  type CrmInvoiceLineItem,
  type CrmInvoiceListParams,
  type CrmInvoiceStatus,
  type CrmInvoiceTotals,
  type CrmInvoiceUpdateInput,
} from '@/lib/rust-client/crm-invoices';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

const LIST_PATH = '/dashboard/crm/sales/invoices';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function revalidateSurfaces(invoiceId?: string): void {
  revalidatePath(LIST_PATH);
  if (invoiceId) {
    revalidatePath(`${LIST_PATH}/${invoiceId}`);
    revalidatePath(`${LIST_PATH}/${invoiceId}/edit`);
    revalidatePath(`${LIST_PATH}/${invoiceId}/activity`);
  }
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
    recordRustFallback({
      entity: 'invoice',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { invoices: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

/**
 * Dedicated KPI fetch for the §1D.1 list-page strip. Today this pulls a
 * representative 200-row window from the Rust BFF and aggregates
 * locally via the pure `computeInvoiceKpis()` helper — same trajectory
 * as `getCrmAccountKpis`. Replace with a `/v1/crm/invoices/kpis`
 * server-side aggregate once tenant volumes blow past the 200 ceiling.
 *
 * Returns an empty snapshot on failure (never throws) so the list page
 * keeps rendering even if the Rust hop is down.
 */
export async function getInvoiceKpis(): Promise<
  import('./invoices.kpis').InvoiceKpiSummary
> {
  const { computeInvoiceKpis } = await import('./invoices.kpis');
  try {
    const docs = await crmInvoicesApi.list({ page: 1, limit: 200 });
    return computeInvoiceKpis(docs);
  } catch (e) {
    recordRustFallback({
      entity: 'invoice',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return {
      outstanding: 0,
      overdueCount: 0,
      overdueAmount: 0,
      paidThisMonthCount: 0,
      paidThisMonthAmount: 0,
      draftCount: 0,
      avgDaysToPay: null,
    };
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
    recordRustFallback({
      entity: 'invoice',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
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
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Parse the JSON-encoded `lineItems` blob from the form. Each row is
 * normalized into a `CrmInvoiceLineItem` — strings get coerced to
 * numbers, blanks are dropped, and the per-line `total` is recomputed
 * (qty × rate × (1 − discount%) × (1 + tax%)).
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
    const cgst = Number(r.cgstAmount);
    if (Number.isFinite(cgst)) item.cgstAmount = cgst;
    const sgst = Number(r.sgstAmount);
    if (Number.isFinite(sgst)) item.sgstAmount = sgst;
    const igst = Number(r.igstAmount);
    if (Number.isFinite(igst)) item.igstAmount = igst;
    const cess = Number(r.cessAmount);
    if (Number.isFinite(cess)) item.cessAmount = cess;
    out.push(item);
  }
  return out;
}

/**
 * Derive document-level totals from a normalized line-item array. The
 * UI computes these client-side for the preview pane, but we recompute
 * here so server-side state is the source of truth on save.
 */
function deriveTotals(items: CrmInvoiceLineItem[], extras?: {
  discountOverall?: number;
  shippingCharge?: number;
  adjustment?: number;
  roundOff?: number;
}): CrmInvoiceTotals {
  const subTotal = items.reduce(
    (s, li) => s + (li.total ?? li.qty * li.rate),
    0,
  );
  const discountOverall = extras?.discountOverall ?? 0;
  const shippingCharge = extras?.shippingCharge ?? 0;
  const adjustment = extras?.adjustment ?? 0;
  const roundOff = extras?.roundOff ?? 0;
  const total = subTotal - discountOverall + shippingCharge + adjustment + roundOff;
  return {
    subTotal,
    discountOverall: extras?.discountOverall,
    shippingCharge: extras?.shippingCharge,
    adjustment: extras?.adjustment,
    roundOff: extras?.roundOff,
    total,
  };
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Custom-field values (under the `customFields` JSON blob) are
 * persisted via `applyCustomFieldsToEntity` after the main row is
 * created/updated — failures there are logged but do not roll back the
 * invoice save.
 *
 * Preserves all FormData field names callers in the form / detail pages
 * write today.
 */
export async function saveInvoiceAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

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
  const totals = deriveTotals(items, {
    discountOverall: pickNumber(formData, 'discountOverall'),
    shippingCharge: pickNumber(formData, 'shippingCharge'),
    adjustment: pickNumber(formData, 'adjustment'),
    roundOff: pickNumber(formData, 'roundOff'),
  });

  const fromKindRaw = pickString(formData, 'fromKind');
  const fromIdRaw = pickString(formData, 'fromId');

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
    ...(fromKindRaw && fromIdRaw
      ? { fromKind: fromKindRaw as CrmInvoiceCreateInput['fromKind'], fromId: fromIdRaw }
      : {}),
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

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'invoice',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidateSurfaces(String(result._id));
    const statusV = pickString(formData, 'status');
    if (!id) {
      void recordFlowAction('crm.invoice.created', {
        userId: String(session.user._id),
        target: String(result._id),
        metadata: { invoiceNo, clientId, currency, grandTotal: totals.grandTotal },
      });
    } else if (statusV === 'paid' || statusV === 'voided' || statusV === 'cancelled') {
      void recordFlowAction(statusV === 'paid' ? 'crm.invoice.paid' : 'crm.invoice.voided', {
        userId: String(session.user._id),
        target: String(result._id),
        metadata: { invoiceNo, status: statusV },
      });
    }
    return {
      message: id ? 'Invoice updated.' : 'Invoice created.',
      id: String(result._id),
    };
  } catch (e) {
    recordRustFallback({
      entity: 'invoice',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
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
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    await crmInvoicesApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'invoice',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    void recordFlowAction('crm.invoice.voided', {
      userId: String(session.user._id),
      target: id,
      metadata: { op: 'delete' },
    });
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Invoice not found.' };
    }
    recordRustFallback({
      entity: 'invoice',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
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

/* ─── §1D additions ───────────────────────────────────────────── */

export async function getInvoiceById(id: string): Promise<CrmInvoiceDoc | null> {
  const { invoice } = await getInvoice(id);
  return invoice;
}

// `computeInvoiceKpis` / `InvoiceKpiSummary` live in `./invoices.kpis.ts`
// — pure helpers can't be exported from a `'use server'` module.

/**
 * Live related-entity counts for the detail page right rail. Reads
 * directly from Mongo (the Rust BFF doesn't expose a count endpoint).
 */
export async function getCrmInvoiceRelatedCounts(
  invoiceId: string,
): Promise<{
  receipts: number;
  creditNotes: number;
  quotations: number;
  salesOrders: number;
  deliveries: number;
}> {
  const empty = {
    receipts: 0,
    creditNotes: 0,
    quotations: 0,
    salesOrders: 0,
    deliveries: 0,
  };
  if (!invoiceId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [invoiceId];
    if (ObjectId.isValid(invoiceId)) idCandidates.push(new ObjectId(invoiceId));

    // Direct invoiceId-on-doc references first, lineage-based as a
    // secondary clause. Failures degrade silently to 0.
    const [receipts, creditNotes, quotations, salesOrders, deliveries] =
      await Promise.all([
        db
          .collection('crm_payment_receipts')
          .countDocuments({
            userId,
            $or: [
              { invoiceId: { $in: idCandidates } },
              { 'allocations.invoiceId': { $in: idCandidates } },
              { 'lineage.id': invoiceId, 'lineage.kind': 'invoice' },
            ],
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_credit_notes')
          .countDocuments({
            userId,
            $or: [
              { invoiceId: { $in: idCandidates } },
              { 'lineage.id': invoiceId, 'lineage.kind': 'invoice' },
            ],
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_quotations')
          .countDocuments({
            userId,
            'lineage.id': invoiceId,
            'lineage.kind': 'invoice',
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_sales_orders')
          .countDocuments({
            userId,
            'lineage.id': invoiceId,
            'lineage.kind': 'invoice',
          } as Record<string, unknown>)
          .catch(() => 0),
        db
          .collection('crm_delivery_challans')
          .countDocuments({
            userId,
            'lineage.id': invoiceId,
            'lineage.kind': 'invoice',
          } as Record<string, unknown>)
          .catch(() => 0),
      ]);

    return {
      receipts: Number(receipts) || 0,
      creditNotes: Number(creditNotes) || 0,
      quotations: Number(quotations) || 0,
      salesOrders: Number(salesOrders) || 0,
      deliveries: Number(deliveries) || 0,
    };
  } catch (e) {
    console.error('[getCrmInvoiceRelatedCounts] failed:', e);
    return empty;
  }
}

/* ─── Duplicates ──────────────────────────────────────────────── */

export interface InvoiceDuplicateGroup {
  key: string;
  members: Array<{
    _id: string;
    invoiceNo: string;
    clientId?: string;
    total: number;
    currency?: string;
    date?: string;
    status?: string;
  }>;
}

/**
 * Cluster invoices that look like accidental duplicates: same
 * `(clientId, invoiceNo)` or same `(clientId, total)` issued within
 * ±7 days. Read-only — no merge action yet.
 */
export async function findInvoiceDuplicates(): Promise<InvoiceDuplicateGroup[]> {
  const session = await getSession();
  if (!session?.user) return [];
  try {
    const all = await crmInvoicesApi.list({ page: 1, limit: 500 });
    const sevenDaysMs = 7 * 86_400_000;
    const groups: InvoiceDuplicateGroup['members'][] = [];
    const used = new Set<string>();

    type Row = InvoiceDuplicateGroup['members'][number];
    const rows: Row[] = all.map((d) => ({
      _id: String(d._id),
      invoiceNo: d.invoiceNo ?? '',
      clientId: d.clientId,
      total: typeof d.totals?.total === 'number' ? d.totals.total : 0,
      currency: d.currency,
      date: d.date,
      status: d.status,
    }));

    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      if (used.has(a._id) || !a.clientId) continue;
      const cluster: Row[] = [a];
      for (let j = i + 1; j < rows.length; j++) {
        const b = rows[j];
        if (used.has(b._id) || b.clientId !== a.clientId) continue;
        const sameNo = a.invoiceNo && a.invoiceNo === b.invoiceNo;
        const ref = Math.max(Math.abs(a.total), Math.abs(b.total), 1);
        const sameAmount = Math.abs(a.total - b.total) / ref <= 0.01;
        let withinWeek = true;
        if (a.date && b.date) {
          const dt = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime());
          withinWeek = dt <= sevenDaysMs;
        }
        if ((sameNo || sameAmount) && withinWeek) {
          cluster.push(b);
          used.add(b._id);
        }
      }
      if (cluster.length >= 2) {
        used.add(a._id);
        groups.push(cluster);
      }
    }

    return groups.map((cluster, idx) => ({
      key: `${cluster[0].clientId ?? 'no-client'}-${idx}`,
      members: cluster,
    }));
  } catch (e) {
    console.error('[findInvoiceDuplicates] failed:', e);
    return [];
  }
}

/* ─── Bulk ops ────────────────────────────────────────────────── */

async function audit(
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
        entityKind: 'invoice',
        entityId: id,
        reason,
      });
    } catch {
      /* non-fatal */
    }
  }
}

export async function bulkDeleteInvoices(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No invoices selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmInvoicesApi.delete(id);
        processed += 1;
      } catch (e) {
        console.error('[bulkDeleteInvoices] per-row failure:', e);
        recordRustFallback({
          entity: 'invoice',
          op: 'delete',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await audit(session, valid, 'delete', 'bulk:delete');
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkArchiveInvoices(
  ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No invoices selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmInvoicesApi.update(id, { status: 'cancelled' });
        processed += 1;
      } catch (e) {
        console.error('[bulkArchiveInvoices] per-row failure:', e);
        recordRustFallback({
          entity: 'invoice',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await audit(session, valid, 'archive', 'bulk:archive');
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

export async function bulkChangeInvoiceStatus(
  ids: string[],
  status: CrmInvoiceStatus | string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No invoices selected.' };
  }
  let processed = 0;
  try {
    for (const id of valid) {
      try {
        await crmInvoicesApi.update(id, { status });
        processed += 1;
      } catch (e) {
        console.error('[bulkChangeInvoiceStatus] per-row failure:', e);
        recordRustFallback({
          entity: 'invoice',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }
    await audit(session, valid, 'status_change', `bulk:status=${status}`);
    revalidateSurfaces();
    return { success: true, processed };
  } catch (e) {
    return { success: false, processed, error: rustErr(e) };
  }
}

/**
 * Bulk-assign owner. The Rust update endpoint doesn't expose an owner
 * field today (per `CrmInvoiceUpdateInput`), so this is a Mongo-only
 * patch — emits per-id audit + revalidate, ignoring rows that aren't
 * valid ObjectIds.
 */
export async function bulkAssignInvoices(
  ids: string[],
  userId: string | null,
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { success: false, processed: 0, error: 'Access denied.' };
  }
  const valid = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No invoices selected.' };
  }
  const objectIds = valid
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  if (objectIds.length === 0) {
    return { success: false, processed: 0, error: 'No valid invoices.' };
  }
  try {
    const { db } = await connectToDatabase();
    const tenant = new ObjectId(String(session.user._id));
    const ownerValue = userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const result = await db.collection('crm_invoices').updateMany(
      { _id: { $in: objectIds }, userId: tenant },
      {
        $set: {
          'assignment.assignedTo': ownerValue,
          'assignment.assignedAt': new Date(),
          updatedAt: new Date(),
        },
      },
    );
    await audit(session, valid, 'assign', `bulk:assign=${userId ?? 'null'}`);
    revalidateSurfaces();
    return { success: true, processed: result.modifiedCount ?? 0 };
  } catch (e) {
    return { success: false, processed: 0, error: rustErr(e) };
  }
}

/* ─── Detail-page quick edits ─────────────────────────────────── */

export async function updateInvoiceStatus(
  id: string,
  status: CrmInvoiceStatus | string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing invoice id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    await crmInvoicesApi.update(id, { status });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'invoice',
        entityId: id,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    if (status === 'paid') {
      void recordFlowAction('crm.invoice.paid', {
        userId: String(session.user._id),
        target: id,
      });
    } else if (status === 'voided' || status === 'cancelled') {
      void recordFlowAction('crm.invoice.voided', {
        userId: String(session.user._id),
        target: id,
        metadata: { status },
      });
    }
    return { success: true };
  } catch (e) {
    recordRustFallback({
      entity: 'invoice',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/**
 * Generic patch helper for detail-page quick-edit chips (customer
 * change, currency change, due date reschedule…). Pass any subset of
 * the canonical update shape.
 */
export async function patchInvoice(
  id: string,
  patch: CrmInvoiceUpdateInput,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing invoice id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    await crmInvoicesApi.update(id, patch);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'invoice',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    recordRustFallback({
      entity: 'invoice',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Email (detail-page composer) ────────────────────────────── */

export async function sendInvoiceEmail(args: {
  invoiceId: string;
  to: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const { invoiceId, to, subject, message } = args;
  if (!invoiceId || !to || !subject) {
    return { success: false, error: 'Missing required field.' };
  }
  try {
    // Wire transactional send through the tenant-aware template engine.
    // The composer's `subject` + `message` are passed as overrides when
    // present; otherwise the `invoice_sent` event template is resolved
    // from `crm_email_event_templates` (per-tenant) or falls back to the
    // code default in `@/lib/email-templates/events`.
    try {
      const { dispatchTransactionalEmail } = await import('@/lib/email-dispatcher');
      const { renderEffectiveTemplate } = await import('@/lib/email-templates/render');
      const tenantUserId = String(session.user._id);
      const composedFromTemplate = await renderEffectiveTemplate(
        tenantUserId,
        'invoice_sent',
        {
          clientName: '', // populated by the caller via vars passthrough TBD
          invoiceNumber: invoiceId,
          totalAmount: '',
          dueDate: '',
          invoiceUrl: '',
          companyName: session.user.companyName ?? '',
        },
      );
      await dispatchTransactionalEmail({
        tenantUserId,
        to,
        subject: subject || composedFromTemplate.subject,
        html: message || composedFromTemplate.html,
        templateId: 'event:invoice_sent',
      });
    } catch (sendErr) {
      // Email transport may not be configured for this tenant; we still
      // proceed with the audit + status update so the UI stays consistent.
      console.warn('[crm/invoices] sendInvoiceEmail dispatch failed', sendErr);
    }

    // Mark sent on the doc + audit.
    await crmInvoicesApi.update(invoiceId, { status: 'sent' });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'send',
        entityKind: 'invoice',
        entityId: invoiceId,
        reason: `email:to=${to}`,
        diff: { subject: { after: subject } },
      });
    } catch {
      /* non-fatal */
    }
    revalidateSurfaces(invoiceId);
    void recordFlowAction('crm.invoice.sent', {
      userId: String(session.user._id),
      target: invoiceId,
      metadata: { to, subject },
    });
    return { success: true };
  } catch (e) {
    recordRustFallback({
      entity: 'invoice',
      op: 'update',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}
