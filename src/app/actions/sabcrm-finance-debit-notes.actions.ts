'use server';

/**
 * SabCRM Finance — debit-note surface server actions.
 *
 * The full doc-surface data paths for `/sabcrm/finance/debit-notes`
 * (finance-rollout spec §3.5) — the vendor-side mirror of
 * `sabcrm-finance-credit-notes.actions.ts`:
 *
 *   - paged display-ready list rows (vendor labels batch-resolved via
 *     the shared pickers — no ObjectIds reach the client, no N+1);
 *   - KPI strip (debited total / cash refunds pending / this month /
 *     top reason) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (line items + header modifiers recomputed
 *     server-side; `items`/`totals` ride the crate's passthrough-JSON
 *     fields with the exact camelCase LineItem/Totals shapes);
 *   - status transitions validated against `SABCRM_DEBIT_NOTE_TRANSITIONS`;
 *   - related-documents rail (linked bill + lineage parents);
 *   - `?fromBill=` prefill for the bill → debit-note convert.
 *
 * Engine DTO gaps (render-only until Rust PRs land): `exchangeRate` and
 * `attachments` exist on the document model but NOT on the crate's
 * create/update inputs.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings. The Rust engine may be down at dev time — failures are
 * normalised into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceBillsApi,
  sabcrmFinanceDebitNotesApi,
  type SabcrmDebitNoteDoc,
  type SabcrmDebitNoteUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmDebitNoteLineItem,
  CrmDebitNoteTotals,
  DebitNoteReason,
  DebitNoteRefundMode,
  DebitNoteStatus,
} from '@/lib/rust-client/crm-debit-notes';
import {
  computeDocGrandTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import { resolveSabcrmFinanceVendors } from './sabcrm-finance-pickers.actions';
import type { SabcrmRelatedDocRef } from './sabcrm-finance-invoices.actions.types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_DEBIT_NOTE_TRANSITIONS,
  type SabcrmDebitNoteFullInput,
  type SabcrmDebitNoteFullPatch,
  type SabcrmDebitNoteKpis,
  type SabcrmDebitNoteListFilters,
  type SabcrmDebitNoteListPage,
  type SabcrmDebitNoteListRow,
  type SabcrmDebitNotePrefill,
} from './sabcrm-finance-debit-notes.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const DEBIT_NOTES_PATH = '/sabcrm/finance/debit-notes';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  const allowed = await canServer(MODULE_KEY, action, requested);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Vocabulary (mirrors crm_purchases_types::debit_note) ───────── */

const REASONS: ReadonlySet<DebitNoteReason> = new Set([
  'return',
  'discount',
  'price_adjust',
  'cancel',
  'other',
]);

const REFUND_MODES: ReadonlySet<DebitNoteRefundMode> = new Set([
  'cash',
  'credit',
  'replacement',
]);

/* ─── Numbering ────────────────────────────────────────────────── */

/**
 * Suggests the next debit-note number from the latest documents: takes
 * the highest numeric suffix among existing numbers and increments it,
 * preserving prefix + zero-padding. First note ⇒ `DN-<year>-0001`.
 */
export async function getNextSabcrmDebitNoteNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceDebitNotesApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of docs) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.dnNo ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return { ok: true, data: `DN-${new Date().getUTCFullYear()}-0001` };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a debit-note number.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Pages the list endpoint scans for KPIs (100 docs each). */
const KPI_MAX_PAGES = 5;

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * debit notes). `sampled: true` flags a capped result.
 */
export async function getSabcrmDebitNoteKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmDebitNoteDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceDebitNotesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === KPI_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const currencyVotes = new Map<string, number>();
    const reasonVotes = new Map<DebitNoteReason, number>();
    let debitedTotal = 0;
    let refundsPendingAmount = 0;
    let refundsPendingCount = 0;
    let thisMonthTotal = 0;
    let thisMonthCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as DebitNoteStatus;
      const total = doc.totals?.total ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);
      reasonVotes.set(doc.reason, (reasonVotes.get(doc.reason) ?? 0) + 1);

      if (status === 'issued' || status === 'refunded') debitedTotal += total;
      if (status === 'issued' && doc.refundMode === 'cash') {
        refundsPendingAmount += total;
        refundsPendingCount += 1;
      }
      if ((doc.date ?? '').slice(0, 7) === monthKey && status !== 'cancelled') {
        thisMonthTotal += total;
        thisMonthCount += 1;
      }
    }

    let currency = 'INR';
    let votes = -1;
    for (const [code, n] of currencyVotes) {
      if (n > votes) {
        currency = code;
        votes = n;
      }
    }

    let topReason: DebitNoteReason | null = null;
    let topReasonCount = 0;
    for (const [reason, n] of reasonVotes) {
      if (n > topReasonCount) {
        topReason = reason;
        topReasonCount = n;
      }
    }

    return {
      ok: true,
      data: {
        currency,
        debitedTotal: round2(debitedTotal),
        refundsPendingAmount: round2(refundsPendingAmount),
        refundsPendingCount,
        thisMonthTotal: round2(thisMonthTotal),
        thisMonthCount,
        topReason,
        topReasonCount,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute debit-note KPIs.');
  }
}

/* ─── List page (display-ready rows) ───────────────────────────── */

function toListRow(
  doc: SabcrmDebitNoteDoc,
  vendorMap: Map<string, DocEntityOption>,
): SabcrmDebitNoteListRow {
  const vendor = doc.vendorId ? vendorMap.get(doc.vendorId) : undefined;
  return {
    id: doc._id,
    dnNo: doc.dnNo,
    vendorId: doc.vendorId ?? '',
    vendorLabel: vendor?.label ?? null,
    date: doc.date,
    reason: doc.reason,
    refundMode: doc.refundMode,
    currency: doc.currency,
    total: doc.totals?.total ?? 0,
    status: (doc.status ?? 'draft') as DebitNoteStatus,
    linkedBillId: doc.linkedBillId ?? null,
  };
}

/** Batch-resolves the page's vendor ids into a label map (no N+1). */
async function vendorMapFor(
  docs: SabcrmDebitNoteDoc[],
  projectId: string,
): Promise<Map<string, DocEntityOption>> {
  const vendorIds = [...new Set(docs.map((d) => d.vendorId).filter(Boolean))];
  const map = new Map<string, DocEntityOption>();
  if (vendorIds.length > 0) {
    const refs = await resolveSabcrmFinanceVendors(vendorIds, projectId);
    if (refs.ok) for (const ref of refs.data) map.set(ref.id, ref);
  }
  return map;
}

/**
 * Lists a page of display-ready debit-note rows and resolves all vendor
 * labels in one batched pass. Date-range filtering is applied here (the
 * crate's ListQuery has no `from`/`to`).
 *
 * Pagination: exactly `limit` rows are requested (the Rust skip math
 * uses the requested limit); `hasMore` derives from a full page.
 */
export async function listSabcrmDebitNotesPage(
  filters: SabcrmDebitNoteListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinanceDebitNotesApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      vendorId: filters.vendorId || undefined,
    });

    let pageDocs = docs;
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      pageDocs = pageDocs.filter((d) => {
        const day = (d.date ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }

    const hasMore = docs.length === limit;
    const vendorMap = await vendorMapFor(pageDocs, g.ctx.projectId);

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, vendorMap)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list debit notes.');
  }
}

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmDebitNoteRows(
  filters: SabcrmDebitNoteListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmDebitNoteDoc[] = [];
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceDebitNotesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        vendorId: filters.vendorId || undefined,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    let rows = docs;
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      rows = rows.filter((d) => {
        const day = (d.date ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }
    const vendorMap = await vendorMapFor(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, vendorMap)) };
  } catch (e) {
    return fail(e, 'Failed to export debit notes.');
  }
}

/* ─── Single document ──────────────────────────────────────────── */

/** Fetches one debit note (the detail page's server entry). */
export async function getSabcrmDebitNoteFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc>> {
  if (!id) return { ok: false, error: 'Debit note id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceDebitNotesApi.getById(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load the debit note.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Builds the wire `items` + `totals` from form lines + optional header
 * modifiers (authoritative — the crate stores both as passthrough JSON,
 * but the shapes mirror `crm_sales_types` LineItem/Totals exactly).
 */
function buildWireMoney(
  lines: DocLineInput[],
  modifiers?: DocTotalsModifiersInput,
): {
  items: CrmDebitNoteLineItem[];
  totals: CrmDebitNoteTotals;
} | null {
  const meaningful = lines.filter((l) => !isBlankDocLine(l));
  if (meaningful.length === 0) return null;
  const computed = computeDocGrandTotals(meaningful, modifiers);
  return {
    items: computed.lines.map((l) => ({
      itemId: l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
      description: l.description?.trim() || undefined,
      hsnSac: l.hsnSac?.trim() || undefined,
      qty: l.qty,
      unit: l.unit?.trim() || undefined,
      rate: l.rate,
      discountPct: l.discountPct,
      taxRatePct: l.taxRatePct,
      total: l.total,
    })),
    totals: {
      subTotal: computed.subTotal,
      discountOverall: computed.discountOverall || undefined,
      shippingCharge: computed.shippingCharge || undefined,
      adjustment: computed.adjustment || undefined,
      roundOff: computed.roundOff || undefined,
      total: computed.grandTotal,
    },
  };
}

/**
 * Creates a debit note from the FULL doc form — real picked vendor,
 * server-computed totals, validated reason / refund-mode, optional
 * linked bill (which also seeds the lineage chain Rust-side via
 * `fromKind: 'bill'`), optional immediate issue.
 */
export async function createSabcrmDebitNoteFull(
  input: SabcrmDebitNoteFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc>> {
  if (!input?.dnNo?.trim()) {
    return { ok: false, error: 'A debit-note number is required.' };
  }
  if (!input.vendorId || !ObjectId.isValid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor for this debit note.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) {
    return { ok: false, error: 'A valid debit-note date is required.' };
  }
  if (!REASONS.has(input.reason)) {
    return { ok: false, error: 'Pick a valid reason.' };
  }
  if (!REFUND_MODES.has(input.refundMode)) {
    return { ok: false, error: 'Pick a valid refund mode.' };
  }
  if (input.linkedBillId && !ObjectId.isValid(input.linkedBillId)) {
    return { ok: false, error: 'The linked bill reference is invalid.' };
  }
  const money = buildWireMoney(input.lines ?? [], input.totalsModifiers);
  if (!money) {
    return { ok: false, error: 'Add at least one line item.' };
  }
  if (money.totals.total < 0) {
    return { ok: false, error: 'The adjustments push the total below zero.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  // Lineage parent: explicit fromId wins, else the linked bill.
  const fromId =
    input.fromId && ObjectId.isValid(input.fromId)
      ? input.fromId
      : input.linkedBillId;

  try {
    const created = await sabcrmFinanceDebitNotesApi.create(g.ctx.projectId, {
      dnNo: input.dnNo.trim(),
      date: dateIso,
      vendorId: input.vendorId,
      linkedBillId: input.linkedBillId || undefined,
      reason: input.reason,
      currency: input.currency.trim().toUpperCase(),
      items: money.items,
      totals: money.totals,
      refundMode: input.refundMode,
      refundTxnId: input.refundTxnId?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      fromKind: fromId ? 'bill' : undefined,
      fromId: fromId || undefined,
    });

    // The create DTO has no `status` — "save & issue" is a follow-up
    // PATCH (same pattern as the credit-note action).
    let result = created;
    if (input.issue) {
      result = await sabcrmFinanceDebitNotesApi.update(
        g.ctx.projectId,
        created._id,
        { status: 'issued' },
      );
    }

    revalidatePath(DEBIT_NOTES_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create the debit note.');
  }
}

/** Full-form partial update (number, vendor, date, lines, refund fields…). */
export async function updateSabcrmDebitNoteFull(
  id: string,
  patch: SabcrmDebitNoteFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc>> {
  if (!id) return { ok: false, error: 'Debit note id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmDebitNoteUpdateInput = {};
  if (patch.dnNo !== undefined) {
    if (!patch.dnNo.trim()) {
      return { ok: false, error: 'A debit-note number is required.' };
    }
    wire.dnNo = patch.dnNo.trim();
  }
  if (patch.vendorId !== undefined) {
    if (!patch.vendorId || !ObjectId.isValid(patch.vendorId)) {
      return { ok: false, error: 'Pick a vendor for this debit note.' };
    }
    wire.vendorId = patch.vendorId;
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The debit-note date is invalid.' };
    wire.date = iso;
  }
  if (patch.reason !== undefined) {
    if (!REASONS.has(patch.reason)) {
      return { ok: false, error: 'Pick a valid reason.' };
    }
    wire.reason = patch.reason;
  }
  if (patch.refundMode !== undefined) {
    if (!REFUND_MODES.has(patch.refundMode)) {
      return { ok: false, error: 'Pick a valid refund mode.' };
    }
    wire.refundMode = patch.refundMode;
  }
  if (patch.refundTxnId !== undefined) {
    wire.refundTxnId = patch.refundTxnId.trim();
  }
  if (patch.linkedBillId !== undefined) {
    if (patch.linkedBillId && !ObjectId.isValid(patch.linkedBillId)) {
      return { ok: false, error: 'The linked bill reference is invalid.' };
    }
    wire.linkedBillId = patch.linkedBillId || undefined;
  }
  if (patch.lines !== undefined) {
    const money = buildWireMoney(patch.lines, patch.totalsModifiers);
    if (!money) return { ok: false, error: 'Add at least one line item.' };
    if (money.totals.total < 0) {
      return { ok: false, error: 'The adjustments push the total below zero.' };
    }
    wire.items = money.items;
    wire.totals = money.totals;
  } else if (patch.totalsModifiers !== undefined) {
    return {
      ok: false,
      error: 'Totals modifiers can only be updated together with line items.',
    };
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceDebitNotesApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(DEBIT_NOTES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the debit note.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map (e.g. a refunded note is terminal).
 */
export async function transitionSabcrmDebitNoteStatus(
  id: string,
  next: DebitNoteStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc>> {
  if (!id) return { ok: false, error: 'Debit note id is required.' };
  if (!(next in SABCRM_DEBIT_NOTE_TRANSITIONS)) {
    return { ok: false, error: 'Invalid debit-note status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceDebitNotesApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'draft') as DebitNoteStatus;
    if (!SABCRM_DEBIT_NOTE_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a debit note from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceDebitNotesApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(DEBIT_NOTES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the debit-note status.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: the linked bill + lineage PARENTS,
 * resolved to their doc numbers where a finance surface exists. Debit
 * notes have no forward conversions, so there are no children.
 */
export async function getSabcrmDebitNoteRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Debit note id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const note = await sabcrmFinanceDebitNotesApi.getById(g.ctx.projectId, id);
    const out: SabcrmRelatedDocRef[] = [];
    const seen = new Set<string>();

    const refs: { kind: string; id: string }[] = [
      ...(note.linkedBillId ? [{ kind: 'bill', id: note.linkedBillId }] : []),
      ...(note.lineage ?? []),
    ];

    await Promise.all(
      refs.map(async (ref) => {
        const key = `${ref.kind}:${ref.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const base: SabcrmRelatedDocRef = {
          kind: ref.kind,
          id: ref.id,
          label: humaniseKind(ref.kind),
          href: null,
          direction: 'parent',
        };
        if (ref.kind === 'bill') {
          try {
            const doc = await sabcrmFinanceBillsApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.billNo || doc.vendorInvoiceNo || base.label;
            base.href = `/sabcrm/finance/bills/${encodeURIComponent(ref.id)}`;
            base.date = doc.billDate;
            base.amount = doc.totals?.total;
            base.currency = doc.currency;
            base.status = doc.status;
          } catch {
            // Bill gone — keep the humanised kind, no link.
          }
        } else if (ref.kind === 'purchaseOrder') {
          base.href = '/sabcrm/supply/purchase-orders';
        }
        out.push(base);
      }),
    );

    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Prefill (?fromBill= deep link) ───────────────────────────── */

/**
 * Resolves the `?fromBill=<id>` deep link into a create-form seed: the
 * bill number (picker label), its vendor (id + resolved label) and
 * currency. Powers the bill detail's "Create debit note" convert.
 */
export async function getSabcrmDebitNotePrefillFromBill(
  billId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNotePrefill>> {
  if (!billId || !ObjectId.isValid(billId)) {
    return { ok: false, error: 'A valid bill id is required.' };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const bill = await sabcrmFinanceBillsApi.getById(g.ctx.projectId, billId);
    let vendorLabel: string | null = null;
    if (bill.vendorId) {
      const refs = await resolveSabcrmFinanceVendors(
        [bill.vendorId],
        g.ctx.projectId,
      );
      if (refs.ok) vendorLabel = refs.data[0]?.label ?? null;
    }
    return {
      ok: true,
      data: {
        billId,
        billLabel: bill.billNo || bill.vendorInvoiceNo || 'Unnumbered bill',
        vendorId: bill.vendorId ?? '',
        vendorLabel,
        currency: bill.currency || 'INR',
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the bill for prefill.');
  }
}
