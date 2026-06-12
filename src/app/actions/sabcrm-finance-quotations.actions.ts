'use server';

/**
 * SabCRM Finance — quotation-surface server actions.
 *
 * The doc-surface-kit data paths for `/sabcrm/finance/quotations`
 * (finance-rollout spec §3.1), mirroring the flagship
 * `sabcrm-finance-invoices.actions.ts` structure:
 *
 *   - paged display-ready list rows (party labels batch-resolved — no
 *     N+1, no raw ObjectIds reach the client);
 *   - KPI strip (open quote value, acceptance rate, expiring in 7
 *     days, converted this month) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update (totals recomputed server-side via the
 *     shared `finance-doc-math`; the Rust G1/G2 DTO accepts `totals`,
 *     `attachments`, `status`, `exchangeRate`, `referenceNo`);
 *   - status transitions validated against the crate vocabulary AND the
 *     `SABCRM_QUOTATION_TRANSITIONS` map;
 *   - related documents (lineage parents + conversion children);
 *   - converts → sales order / invoice / proforma (creates the child
 *     with `fromKind: 'quotation'` so the Rust side back-links lineage,
 *     then flips this quotation to `converted`).
 *
 * Every action re-runs the session → project → RBAC → plan gate. The
 * Rust engine may be down at dev time — failures normalise into
 * `{ ok: false, error }`.
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
  sabcrmFinanceProformaInvoicesApi,
  sabcrmFinanceQuotationsApi,
  sabcrmFinanceSalesOrdersApi,
  type SabcrmQuotationDoc,
  type SabcrmQuotationUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmQuotationLineItem,
  CrmQuotationStatus,
  CrmQuotationTotals,
} from '@/lib/rust-client/crm-quotations';
import {
  computeDocGrandTotals,
  computeDocTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  createSabcrmInvoiceFull,
  getNextSabcrmInvoiceNumber,
  resolveSabcrmFinanceParties,
} from './sabcrm-finance-invoices.actions';
import type {
  SabcrmDocAttachmentInput,
  SabcrmPartyRef,
  SabcrmRelatedDocRef,
} from './sabcrm-finance-invoices.actions.types';
import {
  SABCRM_QUOTATION_TRANSITIONS,
  type SabcrmQuotationConvertResult,
  type SabcrmQuotationFullInput,
  type SabcrmQuotationFullPatch,
  type SabcrmQuotationKpis,
  type SabcrmQuotationListFilters,
  type SabcrmQuotationListPage,
  type SabcrmQuotationListRow,
} from './sabcrm-finance-quotations.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const QUOTATIONS_PATH = '/sabcrm/finance/quotations';

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

/* ─── Money (shared math → wire shapes) ────────────────────────── */

/**
 * Builds the wire `items` + `totals` from form lines + optional header
 * modifiers — authoritative recompute via the shared doc math (client
 * totals are never trusted).
 */
function buildWireMoney(
  lines: DocLineInput[],
  modifiers?: DocTotalsModifiersInput,
): { items: CrmQuotationLineItem[]; totals: CrmQuotationTotals } | null {
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

/** Validates + narrows the attachments payload (SabFiles pointers only). */
function cleanAttachments(
  attachments: SabcrmDocAttachmentInput[] | undefined,
): SabcrmDocAttachmentInput[] | undefined {
  if (!attachments) return undefined;
  return attachments
    .filter((a) => a.fileId && ObjectId.isValid(a.fileId))
    .map((a) => ({
      fileId: a.fileId,
      name: a.name || undefined,
      mimeType: a.mimeType || undefined,
      size: a.size,
    }));
}

/** Validates the optional exchange rate (finite, > 0). */
function cleanExchangeRate(
  v: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Exchange rate must be a positive number.' };
  }
  return { ok: true, value: n };
}

/** Doc total with the pre-G1 zero-totals fallback (Σ line totals). */
function docTotal(doc: SabcrmQuotationDoc): number {
  const stored = doc.totals?.total ?? 0;
  if (stored > 0) return stored;
  return (doc.items ?? []).reduce((sum, it) => sum + (it.total ?? 0), 0);
}

/* ─── List page (display-ready rows) ───────────────────────────── */

function toListRow(
  doc: SabcrmQuotationDoc,
  partyMap: Map<string, SabcrmPartyRef>,
): SabcrmQuotationListRow {
  const party = doc.clientId ? partyMap.get(doc.clientId) : undefined;
  return {
    id: doc._id,
    quotationNo: doc.quotationNo,
    subject: doc.subject ?? null,
    referenceNo: doc.referenceNo ?? null,
    partyId: doc.clientId ?? '',
    partyLabel: party?.label ?? null,
    partyObjectSlug: party?.objectSlug ?? null,
    date: doc.date,
    validUntil: doc.validUntil,
    currency: doc.currency,
    total: round2(docTotal(doc)),
    status: (doc.status ?? 'draft') as CrmQuotationStatus,
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function applyDateRange(
  docs: SabcrmQuotationDoc[],
  from?: string,
  to?: string,
): SabcrmQuotationDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.date ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

async function resolvePartyMap(
  docs: SabcrmQuotationDoc[],
  projectId: string,
): Promise<Map<string, SabcrmPartyRef>> {
  const partyIds = [...new Set(docs.map((d) => d.clientId).filter(Boolean))];
  const partyMap = new Map<string, SabcrmPartyRef>();
  if (partyIds.length > 0) {
    const refs = await resolveSabcrmFinanceParties(partyIds, projectId);
    if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
  }
  return partyMap;
}

/**
 * Lists a page of display-ready quotation rows with party labels
 * resolved in one batched pass.
 *
 * Pagination: the crate is 1-indexed and computes `skip` from the
 * REQUESTED limit, so we request exactly `limit` rows and derive
 * `hasMore` from a full page (same caveat as invoices — one
 * false-positive "Next" when the total is an exact multiple).
 */
export async function listSabcrmQuotationsPage(
  filters: SabcrmQuotationListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinanceQuotationsApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      clientId: filters.clientId || undefined,
      status: filters.status || undefined,
    });
    const pageDocs = applyDateRange(docs, filters.from, filters.to);
    const hasMore = docs.length === limit;
    const partyMap = await resolvePartyMap(pageDocs, g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, partyMap)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list quotations.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmQuotationRows(
  filters: SabcrmQuotationListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmQuotationDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceQuotationsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        clientId: filters.clientId || undefined,
        status: filters.status || undefined,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const partyMap = await resolvePartyMap(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, partyMap)) };
  } catch (e) {
    return fail(e, 'Failed to export quotations.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * quotations). `sampled: true` flags a capped result.
 */
export async function getSabcrmQuotationKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmQuotationDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceQuotationsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const soonCutoff = now.getTime() + 7 * 86_400_000;
    const currencyVotes = new Map<string, number>();
    let openValue = 0;
    let openCount = 0;
    let won = 0;
    let resolved = 0;
    let expiringSoon = 0;
    let convertedThisMonth = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as CrmQuotationStatus;
      const total = docTotal(doc);
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      const open = status === 'draft' || status === 'sent';
      if (open) {
        openValue += total;
        openCount += 1;
        if (doc.validUntil) {
          const until = new Date(doc.validUntil).getTime();
          if (
            Number.isFinite(until) &&
            until >= now.getTime() &&
            until <= soonCutoff
          ) {
            expiringSoon += 1;
          }
        }
      }
      if (status === 'accepted' || status === 'converted') {
        won += 1;
        resolved += 1;
      } else if (status === 'rejected' || status === 'expired') {
        resolved += 1;
      }
      if (
        status === 'converted' &&
        (doc.updatedAt ?? doc.date ?? '').slice(0, 7) === monthKey
      ) {
        convertedThisMonth += 1;
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

    return {
      ok: true,
      data: {
        currency,
        openValue: round2(openValue),
        openCount,
        acceptanceRatePct:
          resolved > 0 ? Math.round((won / resolved) * 100) : null,
        expiringSoonCount: expiringSoon,
        convertedThisMonth,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute quotation KPIs.');
  }
}

/* ─── Numbering ────────────────────────────────────────────────── */

/**
 * Suggests the next quotation number from the latest documents (highest
 * numeric suffix + 1, padding preserved). First quotation ⇒
 * `QT-<year>-0001`.
 */
export async function getNextSabcrmQuotationNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceQuotationsApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    return { ok: true, data: nextNumberFrom(docs.map((d) => d.quotationNo), 'QT') };
  } catch (e) {
    return fail(e, 'Failed to suggest a quotation number.');
  }
}

/** Highest numeric suffix + 1 (padding preserved); else `<prefix>-<yr>-0001`. */
function nextNumberFrom(numbers: (string | undefined)[], prefix: string): string {
  let best: { prefix: string; num: number; width: number } | null = null;
  for (const number of numbers) {
    const m = /^(.*?)(\d+)\s*$/.exec(number ?? '');
    if (!m) continue;
    const num = Number(m[2]);
    if (!Number.isFinite(num)) continue;
    if (!best || num > best.num) {
      best = { prefix: m[1], num, width: m[2].length };
    }
  }
  if (!best) return `${prefix}-${new Date().getUTCFullYear()}-0001`;
  const next = String(best.num + 1).padStart(best.width, '0');
  return `${best.prefix}${next}`;
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Creates a quotation from the FULL doc form — real picked party, real
 * line items, server-computed totals, SabFiles attachments, optional
 * lineage parent, optional immediate send (status `sent` in the same
 * POST — the G1 DTO accepts an initial status).
 */
export async function createSabcrmQuotationFull(
  input: SabcrmQuotationFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc>> {
  if (!input?.quotationNo?.trim()) {
    return { ok: false, error: 'A quotation number is required.' };
  }
  if (!input.clientId || !ObjectId.isValid(input.clientId)) {
    return { ok: false, error: 'Pick a customer for this quotation.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) {
    return { ok: false, error: 'A valid quotation date is required.' };
  }
  const validIso = input.validUntil ? toIso(input.validUntil) : null;
  if (!validIso) {
    return { ok: false, error: 'A valid "valid until" date is required.' };
  }
  const money = buildWireMoney(input.lines ?? [], input.totalsModifiers);
  if (!money) return { ok: false, error: 'Add at least one line item.' };
  if (money.totals.total < 0) {
    return { ok: false, error: 'The adjustments push the total below zero.' };
  }
  const fx = cleanExchangeRate(input.exchangeRate);
  if (!fx.ok) return { ok: false, error: fx.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceQuotationsApi.create(g.ctx.projectId, {
      quotationNo: input.quotationNo.trim(),
      date: dateIso,
      validUntil: validIso,
      clientId: input.clientId,
      referenceNo: input.referenceNo?.trim() || undefined,
      currency: input.currency.trim().toUpperCase(),
      exchangeRate: fx.value,
      placeOfSupply: input.placeOfSupply?.trim() || undefined,
      subject: input.subject?.trim() || undefined,
      termsAndConditions: input.termsAndConditions?.trim() || undefined,
      notes: input.customerNotes?.trim() || undefined,
      attachments: cleanAttachments(input.attachments),
      items: money.items,
      totals: money.totals,
      status: input.issue ? 'sent' : undefined,
      fromKind: input.fromKind,
      fromId:
        input.fromId && ObjectId.isValid(input.fromId)
          ? input.fromId
          : undefined,
    });

    revalidatePath(QUOTATIONS_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create quotation.');
  }
}

/** Full-form partial update (number, party, dates, lines, notes, files). */
export async function updateSabcrmQuotationFull(
  id: string,
  patch: SabcrmQuotationFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmQuotationUpdateInput = {};
  if (patch.quotationNo !== undefined) {
    if (!patch.quotationNo.trim()) {
      return { ok: false, error: 'A quotation number is required.' };
    }
    wire.quotationNo = patch.quotationNo.trim();
  }
  if (patch.clientId !== undefined) {
    if (!patch.clientId || !ObjectId.isValid(patch.clientId)) {
      return { ok: false, error: 'Pick a customer for this quotation.' };
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
    if (!iso) return { ok: false, error: 'The quotation date is invalid.' };
    wire.date = iso;
  }
  if (patch.validUntil !== undefined) {
    const iso = toIso(patch.validUntil);
    if (!iso) return { ok: false, error: 'The "valid until" date is invalid.' };
    wire.validUntil = iso;
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
  if (patch.exchangeRate !== undefined) {
    const fx = cleanExchangeRate(patch.exchangeRate);
    if (!fx.ok) return { ok: false, error: fx.error };
    wire.exchangeRate = fx.value;
  }
  if (patch.subject !== undefined) wire.subject = patch.subject;
  if (patch.referenceNo !== undefined) wire.referenceNo = patch.referenceNo;
  if (patch.placeOfSupply !== undefined) {
    wire.placeOfSupply = patch.placeOfSupply.trim();
  }
  if (patch.customerNotes !== undefined) wire.notes = patch.customerNotes;
  if (patch.termsAndConditions !== undefined) {
    wire.termsAndConditions = patch.termsAndConditions;
  }
  if (patch.attachments !== undefined) {
    wire.attachments = cleanAttachments(patch.attachments) ?? [];
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceQuotationsApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(QUOTATIONS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update quotation.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map (`converted` is reserved for the
 * convert actions).
 */
export async function transitionSabcrmQuotationStatus(
  id: string,
  next: CrmQuotationStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };
  if (!(next in SABCRM_QUOTATION_TRANSITIONS)) {
    return { ok: false, error: 'Invalid quotation status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceQuotationsApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'draft') as CrmQuotationStatus;
    if (!SABCRM_QUOTATION_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a quotation from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceQuotationsApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(QUOTATIONS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the quotation status.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

/** Kinds that read as conversion CHILDREN of a quotation. */
const CHILD_KINDS = new Set(['salesOrder', 'invoice', 'proforma', 'creditNote']);

const KIND_ROUTES: Record<string, string | null> = {
  quotation: '/sabcrm/finance/quotations',
  salesOrder: '/sabcrm/finance/sales-orders',
  invoice: '/sabcrm/finance/invoices',
  proforma: '/sabcrm/finance/proforma-invoices',
  creditNote: '/sabcrm/finance/credit-notes',
  deal: null,
  lead: null,
};

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: lineage PARENTS (deal / lead) plus
 * conversion CHILDREN (`convertedTo[]` + the Rust back-links the child
 * creates push onto this quotation's `lineage[]`), resolved to real doc
 * numbers + detail routes where a surface exists.
 */
export async function getSabcrmQuotationRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinanceQuotationsApi.getById(g.ctx.projectId, id);
    const refs = new Map<string, { kind: string; id: string }>();
    for (const ref of [...(doc.lineage ?? []), ...(doc.convertedTo ?? [])]) {
      if (!ref?.kind || !ref.id || ref.id === id) continue;
      refs.set(`${ref.kind}:${ref.id}`, ref);
    }

    const out: SabcrmRelatedDocRef[] = [];
    await Promise.all(
      [...refs.values()].map(async (ref) => {
        const direction = CHILD_KINDS.has(ref.kind) ? 'child' : 'parent';
        const route = KIND_ROUTES[ref.kind] ?? null;
        const base: SabcrmRelatedDocRef = {
          kind: ref.kind,
          id: ref.id,
          label: humaniseKind(ref.kind),
          href: route ? `${route}/${encodeURIComponent(ref.id)}` : null,
          direction,
        };
        try {
          if (ref.kind === 'salesOrder') {
            const so = await sabcrmFinanceSalesOrdersApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = so.soNo ?? base.label;
            base.date = so.date;
            base.status = so.status;
            base.amount = so.totals?.total;
            base.currency = so.currency;
          } else if (ref.kind === 'invoice') {
            const inv = await sabcrmFinanceApi.getInvoice(
              g.ctx.projectId,
              ref.id,
            );
            base.label = inv.invoiceNo ?? base.label;
            base.date = inv.date;
            base.status = inv.status;
            base.amount = inv.totals?.total;
            base.currency = inv.currency;
          } else if (ref.kind === 'proforma') {
            const pi = await sabcrmFinanceProformaInvoicesApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = pi.proformaNumber ?? base.label;
            base.date = pi.proformaDate;
            base.status = pi.status;
            base.amount = pi.total;
            base.currency = pi.currency;
          }
        } catch {
          // Child gone (or engine partial outage) — keep the humanised
          // kind, drop the link.
          base.href = null;
        }
        out.push(base);
      }),
    );

    out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Converts (quotation → SO / invoice / proforma) ───────────── */

/** Quotation line items → kit `DocLineInput`s (computed fields dropped). */
function toDocLines(doc: SabcrmQuotationDoc): DocLineInput[] {
  return (doc.items ?? []).map((item) => ({
    itemId: item.itemId,
    description: item.description,
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
  }));
}

/** Today as `YYYY-MM-DD` (UTC — server-side suggestion only). */
function todayKey(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Loads + guards a quotation that is still convertible. */
async function loadConvertible(
  projectId: string,
  id: string,
): Promise<
  { ok: true; doc: SabcrmQuotationDoc } | { ok: false; error: string }
> {
  const doc = await sabcrmFinanceQuotationsApi.getById(projectId, id);
  const status = (doc.status ?? 'draft') as CrmQuotationStatus;
  if (status === 'converted') {
    return { ok: false, error: 'This quotation has already been converted.' };
  }
  if (status === 'rejected' || status === 'expired') {
    return {
      ok: false,
      error: `A ${status} quotation can't be converted — reopen it first.`,
    };
  }
  if ((doc.items ?? []).length === 0) {
    return { ok: false, error: 'This quotation has no line items to convert.' };
  }
  return { ok: true, doc };
}

/** Marks the quotation `converted` (best-effort, after the child saved). */
async function markConverted(projectId: string, id: string): Promise<void> {
  try {
    await sabcrmFinanceQuotationsApi.update(projectId, id, {
      status: 'converted',
    });
  } catch {
    // The child document exists either way — the status flip is
    // recoverable by hand and must not roll back the conversion.
  }
}

/**
 * Converts a quotation into a sales order: copies party, currency, FX
 * and line items, links `quotationRef` + `fromKind: 'quotation'` (the
 * Rust side seeds lineage and back-links this quotation), then flips
 * the quotation to `converted`.
 */
export async function convertSabcrmQuotationToSalesOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationConvertResult>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const guard = await loadConvertible(g.ctx.projectId, id);
    if (!guard.ok) return { ok: false, error: guard.error };
    const doc = guard.doc;

    const money = buildWireMoney(toDocLines(doc));
    if (!money) {
      return { ok: false, error: 'This quotation has no line items to convert.' };
    }

    const existing = await sabcrmFinanceSalesOrdersApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    const soNo = nextNumberFrom(existing.map((d) => d.soNo), 'SO');

    const created = await sabcrmFinanceSalesOrdersApi.create(g.ctx.projectId, {
      soNo,
      date: new Date().toISOString(),
      clientId: doc.clientId,
      quotationRef: id,
      currency: doc.currency,
      exchangeRate: doc.exchangeRate,
      items: money.items,
      totals: money.totals,
      customerNotes: doc.customerNotes,
      status: 'open',
      fromKind: 'quotation',
      fromId: id,
    });

    await markConverted(g.ctx.projectId, id);
    revalidatePath(QUOTATIONS_PATH);
    revalidatePath('/sabcrm/finance/sales-orders');
    return {
      ok: true,
      data: {
        id: created._id,
        number: created.soNo,
        href: `/sabcrm/finance/sales-orders/${encodeURIComponent(created._id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to convert the quotation to a sales order.');
  }
}

/**
 * Converts a quotation into an invoice via the flagship
 * `createSabcrmInvoiceFull` (server-recomputed totals, lineage
 * `fromKind: 'quotation'`), then flips the quotation to `converted`.
 */
export async function convertSabcrmQuotationToInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationConvertResult>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const guard = await loadConvertible(g.ctx.projectId, id);
    if (!guard.ok) return { ok: false, error: guard.error };
    const doc = guard.doc;

    const numberRes = await getNextSabcrmInvoiceNumber(g.ctx.projectId);
    const invoiceNo = numberRes.ok
      ? numberRes.data
      : `INV-${new Date().getUTCFullYear()}-0001`;

    const created = await createSabcrmInvoiceFull(
      {
        invoiceNo,
        clientId: doc.clientId,
        currency: doc.currency,
        date: todayKey(),
        dueDate: todayKey(30),
        lines: toDocLines(doc),
        placeOfSupply: doc.placeOfSupply,
        customerNotes: doc.customerNotes,
        termsAndConditions: doc.termsAndConditions,
        fromKind: 'quotation',
        fromId: id,
      },
      g.ctx.projectId,
    );
    if (!created.ok) return { ok: false, error: created.error };

    await markConverted(g.ctx.projectId, id);
    revalidatePath(QUOTATIONS_PATH);
    return {
      ok: true,
      data: {
        id: created.data._id,
        number: created.data.invoiceNo,
        href: `/sabcrm/finance/invoices/${encodeURIComponent(created.data._id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to convert the quotation to an invoice.');
  }
}

/**
 * Converts a quotation into a proforma invoice (legacy mounted shape —
 * lines mapped `qty→quantity`, `taxRatePct→taxPct`, line `total→amount`;
 * tax/discount rollups recomputed via the shared doc math), then flips
 * the quotation to `converted`. The legacy crate carries no lineage, so
 * the relationship renders from the quotation side only.
 */
export async function convertSabcrmQuotationToProforma(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationConvertResult>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const guard = await loadConvertible(g.ctx.projectId, id);
    if (!guard.ok) return { ok: false, error: guard.error };
    const doc = guard.doc;

    const lines = toDocLines(doc).filter((l) => !isBlankDocLine(l));
    if (lines.length === 0) {
      return { ok: false, error: 'This quotation has no line items to convert.' };
    }
    const computed = computeDocTotals(lines);

    const existing = await sabcrmFinanceProformaInvoicesApi.list(
      g.ctx.projectId,
      { limit: 100 },
    );
    const proformaNumber = nextNumberFrom(
      existing.items.map((d) => d.proformaNumber),
      'PI',
    );

    const created = await sabcrmFinanceProformaInvoicesApi.create(
      g.ctx.projectId,
      {
        proformaNumber,
        accountId: doc.clientId,
        proformaDate: new Date().toISOString(),
        validTillDate: doc.validUntil,
        currency: doc.currency,
        lineItems: computed.lines.map((l) => ({
          itemId:
            l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
          description: l.description?.trim() || 'Item',
          quantity: l.qty,
          rate: l.rate,
          unit: l.unit?.trim() || undefined,
          taxPct: l.taxRatePct,
          amount: l.total,
        })),
        termsAndConditions: doc.termsAndConditions
          ? doc.termsAndConditions
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        notes: doc.customerNotes,
        taxTotal: computed.taxTotal || undefined,
        discountTotal: computed.discountTotal || undefined,
      },
    );

    await markConverted(g.ctx.projectId, id);
    revalidatePath(QUOTATIONS_PATH);
    revalidatePath('/sabcrm/finance/proforma-invoices');
    return {
      ok: true,
      data: {
        id: created.id,
        number: created.entity.proformaNumber,
        href: `/sabcrm/finance/proforma-invoices/${encodeURIComponent(created.id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to convert the quotation to a proforma invoice.');
  }
}
