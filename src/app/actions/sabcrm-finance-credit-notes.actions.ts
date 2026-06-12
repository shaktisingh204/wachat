'use server';

/**
 * SabCRM Finance — credit-note surface server actions.
 *
 * The full doc-surface data paths for `/sabcrm/finance/credit-notes`
 * (finance-rollout spec §3.4), mirroring the flagship
 * `sabcrm-finance-invoices.actions.ts` structure:
 *
 *   - paged display-ready list rows (party labels batch-resolved — no
 *     ObjectIds reach the client, no N+1);
 *   - KPI strip (credited total / cash refunds pending / this month /
 *     top reason) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (line items + header modifiers recomputed
 *     server-side via the shared `finance-doc-math`; client totals are
 *     never trusted), with reason / refund-mode validated against the
 *     crate vocabulary;
 *   - status transitions validated against `SABCRM_CREDIT_NOTE_TRANSITIONS`;
 *   - related-documents rail (linked invoice + lineage parents);
 *   - `?fromInvoice=` prefill for the invoice → credit-note deep link.
 *
 * Engine DTO gaps (render-only until Rust PRs land): `exchangeRate` and
 * `attachments` exist on the document model but NOT on the crate's
 * create/update inputs — the actions never send them, and the detail
 * page renders them read-only when present.
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
  sabcrmFinanceApi,
  sabcrmFinanceCreditNotesApi,
  type SabcrmCreditNoteDoc,
  type SabcrmCreditNoteUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CreditNoteLineItem,
  CreditNoteReason,
  CreditNoteStatus,
  CreditNoteTotals,
  RefundMode,
} from '@/lib/rust-client/crm-credit-notes';
import {
  computeDocGrandTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  resolveSabcrmFinanceParties,
} from './sabcrm-finance-invoices.actions';
import type {
  SabcrmPartyRef,
  SabcrmRelatedDocRef,
} from './sabcrm-finance-invoices.actions.types';
import {
  SABCRM_CREDIT_NOTE_TRANSITIONS,
  type SabcrmCreditNoteFullInput,
  type SabcrmCreditNoteFullPatch,
  type SabcrmCreditNoteKpis,
  type SabcrmCreditNoteListFilters,
  type SabcrmCreditNoteListPage,
  type SabcrmCreditNoteListRow,
  type SabcrmCreditNotePrefill,
} from './sabcrm-finance-credit-notes.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const CREDIT_NOTES_PATH = '/sabcrm/finance/credit-notes';

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

/* ─── Vocabulary (mirrors crm_sales_types::credit_note) ──────────── */

const REASONS: ReadonlySet<CreditNoteReason> = new Set([
  'return',
  'discount',
  'price_adjust',
  'cancel',
  'other',
]);

const REFUND_MODES: ReadonlySet<RefundMode> = new Set([
  'cash',
  'credit',
  'replacement',
]);

/* ─── Numbering ────────────────────────────────────────────────── */

/**
 * Suggests the next credit-note number from the latest documents: takes
 * the highest numeric suffix among existing numbers and increments it,
 * preserving prefix + zero-padding. First note ⇒ `CN-<year>-0001`.
 */
export async function getNextSabcrmCreditNoteNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceCreditNotesApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of docs) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.cnNo ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return { ok: true, data: `CN-${new Date().getUTCFullYear()}-0001` };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a credit-note number.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Pages the list endpoint scans for KPIs (100 docs each). */
const KPI_MAX_PAGES = 5;

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * credit notes). `sampled: true` flags a capped result.
 */
export async function getSabcrmCreditNoteKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmCreditNoteDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceCreditNotesApi.list(g.ctx.projectId, {
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
    const reasonVotes = new Map<CreditNoteReason, number>();
    let creditedTotal = 0;
    let refundsPendingAmount = 0;
    let refundsPendingCount = 0;
    let thisMonthTotal = 0;
    let thisMonthCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as CreditNoteStatus;
      const total = doc.totals?.total ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);
      reasonVotes.set(doc.reason, (reasonVotes.get(doc.reason) ?? 0) + 1);

      if (status === 'issued' || status === 'refunded') creditedTotal += total;
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

    let topReason: CreditNoteReason | null = null;
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
        creditedTotal: round2(creditedTotal),
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
    return fail(e, 'Failed to compute credit-note KPIs.');
  }
}

/* ─── List page (display-ready rows) ───────────────────────────── */

function toListRow(
  doc: SabcrmCreditNoteDoc,
  partyMap: Map<string, SabcrmPartyRef>,
): SabcrmCreditNoteListRow {
  const party = doc.clientId ? partyMap.get(doc.clientId) : undefined;
  return {
    id: doc._id,
    cnNo: doc.cnNo,
    partyId: doc.clientId ?? '',
    partyLabel: party?.label ?? null,
    partyObjectSlug: party?.objectSlug ?? null,
    date: doc.date,
    reason: doc.reason,
    refundMode: doc.refundMode,
    currency: doc.currency,
    total: doc.totals?.total ?? 0,
    status: (doc.status ?? 'draft') as CreditNoteStatus,
    linkedInvoiceId: doc.linkedInvoiceId ?? null,
  };
}

/**
 * Lists a page of display-ready credit-note rows and resolves all party
 * labels in one batched pass. Date-range filtering is applied here (the
 * crate's ListQuery has no `from`/`to`).
 *
 * Pagination: the Rust list handler computes `skip = (page-1) * limit`
 * from the REQUESTED limit, so we request exactly `limit` rows and
 * derive `hasMore` from a full page (one false-positive "Next" when the
 * total is an exact multiple — that page simply renders empty).
 */
export async function listSabcrmCreditNotesPage(
  filters: SabcrmCreditNoteListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinanceCreditNotesApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      clientId: filters.clientId || undefined,
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

    const partyIds = [...new Set(pageDocs.map((d) => d.clientId).filter(Boolean))];
    const partyMap = new Map<string, SabcrmPartyRef>();
    if (partyIds.length > 0) {
      const refs = await resolveSabcrmFinanceParties(partyIds, g.ctx.projectId);
      if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
    }

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, partyMap)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list credit notes.');
  }
}

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmCreditNoteRows(
  filters: SabcrmCreditNoteListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmCreditNoteDoc[] = [];
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceCreditNotesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        clientId: filters.clientId || undefined,
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
    const partyIds = [...new Set(rows.map((d) => d.clientId).filter(Boolean))];
    const partyMap = new Map<string, SabcrmPartyRef>();
    if (partyIds.length > 0) {
      const refs = await resolveSabcrmFinanceParties(partyIds, g.ctx.projectId);
      if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
    }
    return { ok: true, data: rows.map((d) => toListRow(d, partyMap)) };
  } catch (e) {
    return fail(e, 'Failed to export credit notes.');
  }
}

/* ─── Single document ──────────────────────────────────────────── */

/** Fetches one credit note (the detail page's server entry). */
export async function getSabcrmCreditNoteFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc>> {
  if (!id) return { ok: false, error: 'Credit note id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceCreditNotesApi.getById(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load the credit note.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Builds the wire `items` + `totals` from form lines + optional header
 * modifiers (authoritative — mirrors `crm_sales_types::Totals` exactly
 * via the shared `computeDocGrandTotals`).
 */
function buildWireMoney(
  lines: DocLineInput[],
  modifiers?: DocTotalsModifiersInput,
): {
  items: CreditNoteLineItem[];
  totals: CreditNoteTotals;
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
 * Creates a credit note from the FULL doc form — real picked party,
 * server-computed totals, validated reason / refund-mode, optional
 * linked invoice (which also seeds the lineage chain Rust-side via
 * `fromKind: 'invoice'`), optional immediate issue.
 */
export async function createSabcrmCreditNoteFull(
  input: SabcrmCreditNoteFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc>> {
  if (!input?.cnNo?.trim()) {
    return { ok: false, error: 'A credit-note number is required.' };
  }
  if (!input.clientId || !ObjectId.isValid(input.clientId)) {
    return { ok: false, error: 'Pick a customer for this credit note.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) {
    return { ok: false, error: 'A valid credit-note date is required.' };
  }
  if (!REASONS.has(input.reason)) {
    return { ok: false, error: 'Pick a valid reason.' };
  }
  if (!REFUND_MODES.has(input.refundMode)) {
    return { ok: false, error: 'Pick a valid refund mode.' };
  }
  if (input.linkedInvoiceId && !ObjectId.isValid(input.linkedInvoiceId)) {
    return { ok: false, error: 'The linked invoice reference is invalid.' };
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

  // Lineage parent: explicit fromId wins, else the linked invoice.
  const fromId =
    input.fromId && ObjectId.isValid(input.fromId)
      ? input.fromId
      : input.linkedInvoiceId;

  try {
    const created = await sabcrmFinanceCreditNotesApi.create(g.ctx.projectId, {
      cnNo: input.cnNo.trim(),
      date: dateIso,
      clientId: input.clientId,
      linkedInvoiceId: input.linkedInvoiceId || undefined,
      reason: input.reason,
      currency: input.currency.trim().toUpperCase(),
      items: money.items,
      totals: money.totals,
      taxRecalc: input.taxRecalc,
      refundMode: input.refundMode,
      refundTxnId: input.refundTxnId?.trim() || undefined,
      autoApply: input.autoApply,
      notes: input.notes?.trim() || undefined,
      fromKind: fromId ? 'invoice' : undefined,
      fromId: fromId || undefined,
    });

    // The create DTO has no `status` — "save & issue" is a follow-up
    // PATCH (same pattern the proving vertical uses for bills).
    let result = created;
    if (input.issue) {
      result = await sabcrmFinanceCreditNotesApi.update(
        g.ctx.projectId,
        created._id,
        { status: 'issued' },
      );
    }

    revalidatePath(CREDIT_NOTES_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create the credit note.');
  }
}

/** Full-form partial update (number, party, date, lines, refund fields…). */
export async function updateSabcrmCreditNoteFull(
  id: string,
  patch: SabcrmCreditNoteFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc>> {
  if (!id) return { ok: false, error: 'Credit note id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmCreditNoteUpdateInput = {};
  if (patch.cnNo !== undefined) {
    if (!patch.cnNo.trim()) {
      return { ok: false, error: 'A credit-note number is required.' };
    }
    wire.cnNo = patch.cnNo.trim();
  }
  if (patch.clientId !== undefined) {
    if (!patch.clientId || !ObjectId.isValid(patch.clientId)) {
      return { ok: false, error: 'Pick a customer for this credit note.' };
    }
    wire.clientId = patch.clientId;
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The credit-note date is invalid.' };
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
  if (patch.taxRecalc !== undefined) wire.taxRecalc = patch.taxRecalc;
  if (patch.autoApply !== undefined) wire.autoApply = patch.autoApply;
  if (patch.linkedInvoiceId !== undefined) {
    if (patch.linkedInvoiceId && !ObjectId.isValid(patch.linkedInvoiceId)) {
      return { ok: false, error: 'The linked invoice reference is invalid.' };
    }
    wire.linkedInvoiceId = patch.linkedInvoiceId || undefined;
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
    const data = await sabcrmFinanceCreditNotesApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(CREDIT_NOTES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the credit note.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map (e.g. a refunded note is terminal).
 */
export async function transitionSabcrmCreditNoteStatus(
  id: string,
  next: CreditNoteStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc>> {
  if (!id) return { ok: false, error: 'Credit note id is required.' };
  if (!(next in SABCRM_CREDIT_NOTE_TRANSITIONS)) {
    return { ok: false, error: 'Invalid credit-note status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceCreditNotesApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'draft') as CreditNoteStatus;
    if (!SABCRM_CREDIT_NOTE_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a credit note from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceCreditNotesApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(CREDIT_NOTES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the credit-note status.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: the linked invoice + lineage
 * PARENTS, resolved to their doc numbers where a finance surface
 * exists. Credit notes have no forward conversions, so there are no
 * children.
 */
export async function getSabcrmCreditNoteRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Credit note id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const note = await sabcrmFinanceCreditNotesApi.getById(g.ctx.projectId, id);
    const out: SabcrmRelatedDocRef[] = [];
    const seen = new Set<string>();

    const refs: { kind: string; id: string }[] = [
      ...(note.linkedInvoiceId
        ? [{ kind: 'invoice', id: note.linkedInvoiceId }]
        : []),
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
        if (ref.kind === 'invoice') {
          try {
            const doc = await sabcrmFinanceApi.getInvoice(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.invoiceNo ?? base.label;
            base.href = `/sabcrm/finance/invoices/${encodeURIComponent(ref.id)}`;
            base.date = doc.date;
            base.amount = doc.totals?.total;
            base.currency = doc.currency;
            base.status = doc.status;
          } catch {
            // Invoice gone — keep the humanised kind, no link.
          }
        }
        out.push(base);
      }),
    );

    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Prefill (?fromInvoice= deep link) ────────────────────────── */

/**
 * Resolves the `?fromInvoice=<id>` deep link into a create-form seed:
 * the invoice number (picker label), its customer (id + resolved label)
 * and currency.
 */
export async function getSabcrmCreditNotePrefillFromInvoice(
  invoiceId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNotePrefill>> {
  if (!invoiceId || !ObjectId.isValid(invoiceId)) {
    return { ok: false, error: 'A valid invoice id is required.' };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const invoice = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, invoiceId);
    let clientLabel: string | null = null;
    if (invoice.clientId) {
      const refs = await resolveSabcrmFinanceParties(
        [invoice.clientId],
        g.ctx.projectId,
      );
      if (refs.ok) clientLabel = refs.data[0]?.label ?? null;
    }
    return {
      ok: true,
      data: {
        invoiceId,
        invoiceLabel: invoice.invoiceNo,
        clientId: invoice.clientId ?? '',
        clientLabel,
        currency: invoice.currency || 'INR',
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the invoice for prefill.');
  }
}
