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
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { RustApiError } from '@/lib/rust-client';
import {
  crmQuotationsApi,
  type CrmQuotationCreateInput,
  type CrmQuotationDoc,
  type CrmQuotationLineItem,
  type CrmQuotationListParams,
  type CrmQuotationStatus,
  type CrmQuotationUpdateInput,
} from '@/lib/rust-client/crm-quotations';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { getSession } from '@/app/actions/user.actions';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

async function _crmQuotationActorId(): Promise<string | null> {
  try {
    const session = await getSession();
    const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
    const raw = u?._id ?? u?.id;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : String(raw);
  } catch {
    return null;
  }
}

const LIST_PATH = '/dashboard/crm/sales/quotations';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export interface QuotationKpiSnapshot {
  totalOpen: number;
  accepted: number;
  rejected: number;
  expired: number;
  draft: number;
  conversionRatePct: number | null;
  /** Count of quotations dated on/after the first of the current month. */
  totalThisMonth: number;
  /** Sum of `totals.total` (in the dominant currency) across the loaded window. */
  totalQuotedValue: number;
  currency: string;
}

/**
 * Dedicated KPI fetch for the §1D.1 list-page strip. Pulls a
 * representative 200-row window and computes the strip locally — same
 * trajectory as `getCrmAccountKpis` / `getInvoiceKpis`. Replace with a
 * `/v1/crm/quotations/kpis` server-side aggregate once tenants pass the
 * 200 ceiling.
 *
 * Returns an empty snapshot on failure (never throws).
 */
export async function getQuotationKpis(): Promise<QuotationKpiSnapshot> {
  const empty: QuotationKpiSnapshot = {
    totalOpen: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    draft: 0,
    conversionRatePct: null,
    totalThisMonth: 0,
    totalQuotedValue: 0,
    currency: 'INR',
  };
  try {
    const docs = await crmQuotationsApi.list({ page: 1, limit: 200 });
    const now = new Date();
    const nowTs = now.getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let open = 0;
    let accepted = 0;
    let rejected = 0;
    let expired = 0;
    let draft = 0;
    let converted = 0;
    let totalThisMonth = 0;
    let totalQuotedValue = 0;
    let currency = 'INR';
    for (const d of docs) {
      const s = (d.status ?? 'draft').toLowerCase();
      const isExpired =
        s === 'expired' ||
        (typeof d.validUntil === 'string' &&
          new Date(d.validUntil).getTime() < nowTs);
      if (s === 'draft') draft += 1;
      if (s === 'draft' || s === 'sent') open += 1;
      if (s === 'accepted') accepted += 1;
      if (s === 'rejected') rejected += 1;
      if (s === 'converted') converted += 1;
      if (isExpired) expired += 1;
      if (d.currency) currency = d.currency;
      if (typeof d.totals?.total === 'number') totalQuotedValue += d.totals.total;
      if (typeof d.date === 'string') {
        const t = new Date(d.date).getTime();
        if (!Number.isNaN(t) && t >= monthStart) totalThisMonth += 1;
      }
    }
    const conversionRatePct =
      docs.length > 0
        ? Math.round(((accepted + converted) / docs.length) * 1000) / 10
        : null;
    return {
      totalOpen: open,
      accepted,
      rejected,
      expired,
      draft,
      conversionRatePct,
      totalThisMonth,
      totalQuotedValue: Math.round(totalQuotedValue),
      currency,
    };
  } catch (e) {
    recordRustFallback({
      entity: 'quotation',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return empty;
  }
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

  // Auxiliary fields preserved for forward-compat with the legacy
  // direct-Mongo path (`crm-quotations.actions.ts`). The current Rust
  // DTO doesn't accept these yet — we silently swallow them rather
  // than failing the save when the form layer includes them.
  void pickString(formData, 'referenceNo');
  void pickString(formData, 'salesAgentId');
  void pickString(formData, 'dealId');
  void pickString(formData, 'attachmentUrls');
  void pickString(formData, 'signatureImage');
  void pickString(formData, 'templateId');

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
    const actorId = await _crmQuotationActorId();
    if (actorId && !id) {
      void recordFlowAction('crm.quotation.created', {
        userId: actorId,
        target: String(result._id),
        metadata: { quotationNo, clientId },
      });
    } else if (actorId && id) {
      const statusV = pickString(formData, 'status');
      if (statusV === 'accepted') {
        void recordFlowAction('crm.quotation.accepted', {
          userId: actorId,
          target: String(result._id),
        });
      } else if (statusV === 'rejected') {
        void recordFlowAction('crm.quotation.rejected', {
          userId: actorId,
          target: String(result._id),
        });
      } else if (statusV === 'sent') {
        void recordFlowAction('crm.quotation.sent', {
          userId: actorId,
          target: String(result._id),
        });
      }
    }
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
    const actorId = await _crmQuotationActorId();
    if (actorId) {
      void recordFlowAction('crm.quotation.rejected', {
        userId: actorId,
        target: id,
        metadata: { op: 'delete' },
      });
    }
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

/* ─── Bulk + status helpers ───────────────────────────────────── */

async function recordAudit(
  action: 'update' | 'delete' | 'archive',
  entityId: string,
): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.user?._id) return;
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action,
      entityKind: 'quotation',
      entityId,
    });
  } catch (e) {
    console.error('[quotations audit] non-fatal:', e);
  }
}

function trackFallback(op: 'update' | 'delete', e: unknown): void {
  recordRustFallback({
    entity: 'quotation',
    op,
    errorCode: e instanceof RustApiError ? e.code : undefined,
    status: e instanceof RustApiError ? e.status : undefined,
  });
}

export async function updateQuotationStatus(
  id: string,
  status: CrmQuotationStatus | string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing quotation id.' };
  try {
    await crmQuotationsApi.update(id, { status });
    await recordAudit('update', id);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    trackFallback('update', e);
    return { success: false, error: rustErr(e) };
  }
}

export async function archiveQuotationAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing quotation id.' };
  try {
    // The Rust DTO doesn't model archived directly on quotations yet, but
    // the canonical pattern is to soft-state via status.
    await crmQuotationsApi.update(id, { status: 'expired' });
    await recordAudit('archive', id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    trackFallback('update', e);
    return { success: false, error: rustErr(e) };
  }
}

interface BulkResult {
  success: boolean;
  processed: number;
  error?: string;
}

async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<void>,
): Promise<BulkResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, processed: 0, error: 'No quotation ids supplied.' };
  }
  let processed = 0;
  let lastErr: string | undefined;
  for (const id of ids) {
    try {
      await fn(id);
      processed += 1;
    } catch (e) {
      lastErr = rustErr(e);
    }
  }
  revalidatePath(LIST_PATH);
  if (processed === 0) {
    return { success: false, processed, error: lastErr ?? 'Bulk operation failed.' };
  }
  return { success: true, processed, error: lastErr };
}

export async function bulkDeleteQuotations(ids: string[]): Promise<BulkResult> {
  return runBulk(ids, async (id) => {
    await crmQuotationsApi.delete(id);
    await recordAudit('delete', id);
  });
}

export async function bulkArchiveQuotations(ids: string[]): Promise<BulkResult> {
  return runBulk(ids, async (id) => {
    await crmQuotationsApi.update(id, { status: 'expired' });
    await recordAudit('archive', id);
  });
}

export async function bulkChangeQuotationStatus(
  ids: string[],
  status: CrmQuotationStatus | string,
): Promise<BulkResult> {
  return runBulk(ids, async (id) => {
    await crmQuotationsApi.update(id, { status });
    await recordAudit('update', id);
  });
}

/* ─── getCrmQuotationRelatedCounts ──────────────────────────────────────
 * Lightweight aggregate of related-entity counts for the quotation
 * detail right rail (§5.6). Sales orders + invoices descend from a
 * quotation via lineage. Returns 0s on any failure so the UI never
 * blocks.
 */
export async function getCrmQuotationRelatedCounts(
  quotationId: string,
): Promise<{ salesOrders: number; invoices: number }> {
  const empty = { salesOrders: 0, invoices: 0 };
  if (!quotationId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [quotationId];
    if (ObjectId.isValid(quotationId)) idCandidates.push(new ObjectId(quotationId));

    const [salesOrders, invoices] = await Promise.all([
      db
        .collection('crm_sales_orders')
        .countDocuments({
          userId,
          $or: [
            { quotationRef: { $in: idCandidates } },
            { quotationId: { $in: idCandidates } },
            { 'lineage.id': quotationId, 'lineage.kind': 'quotation' },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_invoices')
        .countDocuments({
          userId,
          $or: [
            { quotationId: { $in: idCandidates } },
            { 'lineage.id': quotationId, 'lineage.kind': 'quotation' },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
    ]);

    return {
      salesOrders: Number(salesOrders) || 0,
      invoices: Number(invoices) || 0,
    };
  } catch (e) {
    console.error('[getCrmQuotationRelatedCounts] failed:', e);
    return empty;
  }
}
