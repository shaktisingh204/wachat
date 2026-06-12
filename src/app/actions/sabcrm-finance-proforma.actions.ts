'use server';

/**
 * SabCRM Finance — proforma-invoice-surface server actions.
 *
 * The doc-surface-kit data paths for `/sabcrm/finance/proforma-invoices`
 * (finance-rollout spec §3.3), mirroring the flagship
 * `sabcrm-finance-invoices.actions.ts` structure.
 *
 * ⚠️ Mounted shape traps (all handled here so clients never see them):
 *   - LEGACY crate (`crm-proforma-invoices`), NOT the canonical
 *     `crm_sales_types::ProformaInvoice`;
 *   - crm-common pagination is **0-indexed** — the kit's 1-indexed
 *     `page` is shifted down before it hits the wire, and the envelope's
 *     `hasMore` is exact (the crate probes `limit + 1`);
 *   - statuses are **TitleCase** (`Draft, Issued, Converted, Cancelled`)
 *     plus the crm-common `archived` soft-delete state;
 *   - lines are `{quantity, taxPct, amount}` — mapped from the kit's
 *     `{qty, taxRatePct, total}`;
 *   - the crate derives `subtotal` (Σ qty × rate, gross) and
 *     `total = subtotal + taxTotal − discountTotal` itself, so this
 *     module sends only the recomputed `taxTotal` / `discountTotal`;
 *   - create accepts no initial status — "save & issue" is a create
 *     followed by a `status: 'Issued'` PATCH.
 *
 * Every action re-runs the session → project → RBAC → plan gate;
 * engine failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceProformaInvoicesApi,
  sabcrmFinanceSalesOrdersApi,
  type SabcrmProformaInvoiceDoc,
  type SabcrmProformaUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmProformaLineItem,
  CrmProformaStatus,
} from '@/lib/rust-client/crm-proforma-invoices';
import {
  computeDocTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  createSabcrmInvoiceFull,
  getNextSabcrmInvoiceNumber,
  resolveSabcrmFinanceParties,
} from './sabcrm-finance-invoices.actions';
import type {
  SabcrmPartyRef,
  SabcrmRelatedDocRef,
} from './sabcrm-finance-invoices.actions.types';
import {
  SABCRM_PROFORMA_TRANSITIONS,
  type SabcrmProformaConvertResult,
  type SabcrmProformaFullInput,
  type SabcrmProformaFullPatch,
  type SabcrmProformaKpis,
  type SabcrmProformaListFilters,
  type SabcrmProformaListPage,
  type SabcrmProformaListRow,
} from './sabcrm-finance-proforma.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const PROFORMA_PATH = '/sabcrm/finance/proforma-invoices';

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

/* ─── Money (shared math → legacy wire lines) ──────────────────── */

/**
 * Form lines → legacy wire `lineItems` + rollups. The crate derives
 * `subtotal` (gross Σ qty × rate) and `total = subtotal + taxTotal −
 * discountTotal`, which lands on exactly the shared-math grand total.
 */
function buildWireLines(lines: DocLineInput[]): {
  lineItems: CrmProformaLineItem[];
  taxTotal: number | undefined;
  discountTotal: number | undefined;
} | null {
  const meaningful = lines.filter((l) => !isBlankDocLine(l));
  if (meaningful.length === 0) return null;
  const computed = computeDocTotals(meaningful);
  return {
    lineItems: computed.lines.map((l) => ({
      itemId: l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
      description: l.description?.trim() || 'Item',
      quantity: l.qty,
      rate: l.rate,
      unit: l.unit?.trim() || undefined,
      taxPct: l.taxRatePct,
      amount: l.total,
    })),
    taxTotal: computed.taxTotal || undefined,
    discountTotal: computed.discountTotal || undefined,
  };
}

/** Textarea → wire `string[]` (split on newlines, blanks dropped). */
function splitTerms(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

/** Validates the optional advance percentage (finite, 0–100). */
function cleanAdvancePct(
  v: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, error: 'Advance % must be between 0 and 100.' };
  }
  return { ok: true, value: round2(n) };
}

/** Validates the optional advance amount (finite, ≥ 0). */
function cleanAdvanceAmount(
  v: number | undefined,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'Advance amount must be zero or more.' };
  }
  return { ok: true, value: round2(n) };
}

/* ─── List page (display-ready rows) ───────────────────────────── */

function toListRow(
  doc: SabcrmProformaInvoiceDoc,
  partyMap: Map<string, SabcrmPartyRef>,
): SabcrmProformaListRow {
  const party = doc.accountId ? partyMap.get(doc.accountId) : undefined;
  return {
    id: doc._id,
    proformaNumber: doc.proformaNumber,
    partyId: doc.accountId ?? '',
    partyLabel: party?.label ?? null,
    partyObjectSlug: party?.objectSlug ?? null,
    proformaDate: doc.proformaDate,
    validTillDate: doc.validTillDate ?? null,
    currency: doc.currency || 'INR',
    total: round2(doc.total ?? 0),
    advanceAmount:
      doc.advanceAmount !== undefined ? round2(doc.advanceAmount) : null,
    // NB: TitleCase vocabulary on this crate.
    status: (doc.status ?? 'Draft') as CrmProformaStatus,
  };
}

function applyDateRange(
  docs: SabcrmProformaInvoiceDoc[],
  from?: string,
  to?: string,
): SabcrmProformaInvoiceDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.proformaDate ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

async function resolvePartyMap(
  docs: SabcrmProformaInvoiceDoc[],
  projectId: string,
): Promise<Map<string, SabcrmPartyRef>> {
  const partyIds = [
    ...new Set(
      docs
        .map((d) => d.accountId)
        .filter((id): id is string => typeof id === 'string' && id !== ''),
    ),
  ];
  const partyMap = new Map<string, SabcrmPartyRef>();
  if (partyIds.length > 0) {
    const refs = await resolveSabcrmFinanceParties(partyIds, projectId);
    if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
  }
  return partyMap;
}

/**
 * Lists a page of display-ready proforma rows with party labels
 * resolved in one batched pass.
 *
 * Pagination trap: this crm-common crate is **0-indexed** — the kit's
 * 1-indexed `page` is shifted down here (`page 1 ⇒ wire 0`). Passing
 * the 1-indexed value straight through would silently skip the first
 * `limit` documents. `hasMore` comes from the envelope (exact — the
 * crate probes `limit + 1`).
 */
export async function listSabcrmProformaPage(
  filters: SabcrmProformaListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceProformaInvoicesApi.list(g.ctx.projectId, {
      page: page - 1, // 1-indexed kit → 0-indexed crm-common wire.
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      accountId: filters.accountId || undefined,
    });
    const pageDocs = applyDateRange(res.items, filters.from, filters.to);
    const partyMap = await resolvePartyMap(pageDocs, g.ctx.projectId);
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, partyMap)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list proforma invoices.');
  }
}

/**
 * Fetches a single proforma invoice (the shared tranche file exposes no
 * getter for this entity — 404 ⇒ `{ ok: false }`).
 */
export async function getSabcrmProformaDoc(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceProformaInvoicesApi.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load proforma invoice.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmProformaRows(
  filters: SabcrmProformaListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmProformaInvoiceDoc[] = [];
    // 0-indexed scan: wire pages 0..4.
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceProformaInvoicesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        accountId: filters.accountId || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    const partyMap = await resolvePartyMap(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, partyMap)) };
  } catch (e) {
    return fail(e, 'Failed to export proforma invoices.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * proformas). `sampled: true` flags a capped result.
 */
export async function getSabcrmProformaKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmProformaKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmProformaInvoiceDoc[] = [];
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceProformaInvoicesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const currencyVotes = new Map<string, number>();
    let outstandingValue = 0;
    let issuedCount = 0;
    let draftCount = 0;
    let convertedThisMonth = 0;
    let issueLagDays = 0;
    let issueLagSamples = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'Draft') as CrmProformaStatus;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (status === 'Issued') {
        outstandingValue += doc.total ?? 0;
        issuedCount += 1;
        // Draft→Issued proxy: createdAt → updatedAt (the legacy shape
        // carries no per-transition timestamps).
        const created = doc.createdAt ? new Date(doc.createdAt).getTime() : NaN;
        const updated = doc.updatedAt ? new Date(doc.updatedAt).getTime() : NaN;
        if (Number.isFinite(created) && Number.isFinite(updated) && updated >= created) {
          issueLagDays += (updated - created) / 86_400_000;
          issueLagSamples += 1;
        }
      } else if (status === 'Draft') {
        draftCount += 1;
      } else if (
        status === 'Converted' &&
        (doc.updatedAt ?? doc.proformaDate ?? '').slice(0, 7) === monthKey
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
        outstandingValue: round2(outstandingValue),
        issuedCount,
        draftCount,
        convertedThisMonth,
        avgDaysToIssue:
          issueLagSamples > 0
            ? Math.round((issueLagDays / issueLagSamples) * 10) / 10
            : null,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute proforma KPIs.');
  }
}

/* ─── Numbering ────────────────────────────────────────────────── */

/** Suggests the next proforma number (`PI-` prefix on first use). */
export async function getNextSabcrmProformaNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFinanceProformaInvoicesApi.list(g.ctx.projectId, {
      limit: 100,
    });
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of res.items) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.proformaNumber ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return { ok: true, data: `PI-${new Date().getUTCFullYear()}-0001` };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a proforma number.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/**
 * Creates a proforma invoice from the FULL doc form. `issue: true`
 * follows up with a `status: 'Issued'` PATCH (the legacy create DTO
 * accepts no initial status).
 */
export async function createSabcrmProformaFull(
  input: SabcrmProformaFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc>> {
  if (!input?.proformaNumber?.trim()) {
    return { ok: false, error: 'A proforma number is required.' };
  }
  if (!input.accountId || !ObjectId.isValid(input.accountId)) {
    return { ok: false, error: 'Pick a customer for this proforma.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.proformaDate ? toIso(input.proformaDate) : null;
  if (!dateIso) return { ok: false, error: 'A valid proforma date is required.' };
  const validIso = input.validTillDate ? toIso(input.validTillDate) : null;
  if (!validIso) {
    return { ok: false, error: 'A valid "valid till" date is required.' };
  }
  const money = buildWireLines(input.lines ?? []);
  if (!money) return { ok: false, error: 'Add at least one line item.' };
  if (input.linkedSoId && !ObjectId.isValid(input.linkedSoId)) {
    return { ok: false, error: 'The linked sales order is invalid.' };
  }
  const pct = cleanAdvancePct(input.advancePct);
  if (!pct.ok) return { ok: false, error: pct.error };
  const amount = cleanAdvanceAmount(input.advanceAmount);
  if (!amount.ok) return { ok: false, error: amount.error };
  const payDueIso = input.paymentDueDate ? toIso(input.paymentDueDate) : undefined;
  if (input.paymentDueDate && !payDueIso) {
    return { ok: false, error: 'The advance payment due date is invalid.' };
  }
  const deliveryIso = input.expectedDelivery
    ? toIso(input.expectedDelivery)
    : undefined;
  if (input.expectedDelivery && !deliveryIso) {
    return { ok: false, error: 'The expected delivery date is invalid.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceProformaInvoicesApi.create(
      g.ctx.projectId,
      {
        proformaNumber: input.proformaNumber.trim(),
        accountId: input.accountId,
        proformaDate: dateIso,
        validTillDate: validIso,
        currency: input.currency.trim().toUpperCase(),
        linkedSoId: input.linkedSoId || undefined,
        advancePct: pct.value,
        advanceAmount: amount.value,
        paymentDueDate: payDueIso ?? undefined,
        expectedDelivery: deliveryIso ?? undefined,
        lineItems: money.lineItems,
        termsAndConditions: splitTerms(input.termsAndConditions),
        notes: input.notes?.trim() || undefined,
        taxTotal: money.taxTotal,
        discountTotal: money.discountTotal,
      },
    );

    let entity = created.entity;
    if (input.issue) {
      entity = await sabcrmFinanceProformaInvoicesApi.update(
        g.ctx.projectId,
        created.id,
        { status: 'Issued' },
      );
    }

    revalidatePath(PROFORMA_PATH);
    return { ok: true, data: { ...entity, _id: created.id } };
  } catch (e) {
    return fail(e, 'Failed to create proforma invoice.');
  }
}

/** Full-form partial update (number, party, dates, lines, terms, advance). */
export async function updateSabcrmProformaFull(
  id: string,
  patch: SabcrmProformaFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmProformaUpdateInput = {};
  if (patch.proformaNumber !== undefined) {
    if (!patch.proformaNumber.trim()) {
      return { ok: false, error: 'A proforma number is required.' };
    }
    wire.proformaNumber = patch.proformaNumber.trim();
  }
  if (patch.accountId !== undefined) {
    if (!patch.accountId || !ObjectId.isValid(patch.accountId)) {
      return { ok: false, error: 'Pick a customer for this proforma.' };
    }
    wire.accountId = patch.accountId;
  }
  if (patch.proformaDate !== undefined) {
    const iso = toIso(patch.proformaDate);
    if (!iso) return { ok: false, error: 'The proforma date is invalid.' };
    wire.proformaDate = iso;
  }
  if (patch.validTillDate !== undefined) {
    const iso = toIso(patch.validTillDate);
    if (!iso) return { ok: false, error: 'The "valid till" date is invalid.' };
    wire.validTillDate = iso;
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.lines !== undefined) {
    const money = buildWireLines(patch.lines);
    if (!money) return { ok: false, error: 'Add at least one line item.' };
    wire.lineItems = money.lineItems;
    wire.taxTotal = money.taxTotal ?? 0;
    wire.discountTotal = money.discountTotal ?? 0;
  }
  if (patch.termsAndConditions !== undefined) {
    wire.termsAndConditions = splitTerms(patch.termsAndConditions) ?? [];
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (patch.linkedSoId !== undefined) {
    if (patch.linkedSoId && !ObjectId.isValid(patch.linkedSoId)) {
      return { ok: false, error: 'The linked sales order is invalid.' };
    }
    if (patch.linkedSoId) wire.linkedSoId = patch.linkedSoId;
  }
  if (patch.advancePct !== undefined) {
    const pct = cleanAdvancePct(patch.advancePct);
    if (!pct.ok) return { ok: false, error: pct.error };
    if (pct.value !== undefined) wire.advancePct = pct.value;
  }
  if (patch.advanceAmount !== undefined) {
    const amount = cleanAdvanceAmount(patch.advanceAmount);
    if (!amount.ok) return { ok: false, error: amount.error };
    if (amount.value !== undefined) wire.advanceAmount = amount.value;
  }
  if (patch.paymentDueDate !== undefined && patch.paymentDueDate) {
    const iso = toIso(patch.paymentDueDate);
    if (!iso) {
      return { ok: false, error: 'The advance payment due date is invalid.' };
    }
    wire.paymentDueDate = iso;
  }
  if (patch.expectedDelivery !== undefined && patch.expectedDelivery) {
    const iso = toIso(patch.expectedDelivery);
    if (!iso) {
      return { ok: false, error: 'The expected delivery date is invalid.' };
    }
    wire.expectedDelivery = iso;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceProformaInvoicesApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(PROFORMA_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update proforma invoice.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the TitleCase
 * vocabulary AND the allowed-transition map (`Converted` is reserved
 * for the convert action).
 */
export async function transitionSabcrmProformaStatus(
  id: string,
  next: CrmProformaStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };
  if (!(next in SABCRM_PROFORMA_TRANSITIONS)) {
    return { ok: false, error: 'Invalid proforma status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceProformaInvoicesApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'Draft') as CrmProformaStatus;
    if (!SABCRM_PROFORMA_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a proforma from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceProformaInvoicesApi.update(
      g.ctx.projectId,
      id,
      { status: next },
    );
    revalidatePath(PROFORMA_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the proforma status.');
  }
}

/* ─── Related documents (rail) ─────────────────────────────────── */

/**
 * Builds the related rail. The legacy shape carries no `lineage[]` —
 * the only first-class link is the G3 `linkedSoId` parent. Invoice
 * children render from the invoice side (its lineage back-reference).
 */
export async function getSabcrmProformaRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinanceProformaInvoicesApi.getById(
      g.ctx.projectId,
      id,
    );
    const out: SabcrmRelatedDocRef[] = [];
    if (doc.linkedSoId) {
      const base: SabcrmRelatedDocRef = {
        kind: 'salesOrder',
        id: doc.linkedSoId,
        label: 'Sales order',
        href: `/sabcrm/finance/sales-orders/${encodeURIComponent(doc.linkedSoId)}`,
        direction: 'parent',
      };
      try {
        const so = await sabcrmFinanceSalesOrdersApi.getById(
          g.ctx.projectId,
          doc.linkedSoId,
        );
        base.label = so.soNo ?? base.label;
        base.date = so.date;
        base.status = so.status;
        base.amount = so.totals?.total;
        base.currency = so.currency;
      } catch {
        base.href = null;
      }
      out.push(base);
    }
    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Convert (proforma → invoice) ─────────────────────────────── */

/**
 * Converts a proforma into an invoice via the flagship
 * `createSabcrmInvoiceFull` (`fromKind: 'proforma'` seeds the invoice's
 * lineage), then PATCHes this proforma to `Converted`.
 */
export async function convertSabcrmProformaToInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaConvertResult>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinanceProformaInvoicesApi.getById(
      g.ctx.projectId,
      id,
    );
    const status = (doc.status ?? 'Draft') as CrmProformaStatus;
    if (status === 'Converted') {
      return { ok: false, error: 'This proforma has already been converted.' };
    }
    if (status === 'Cancelled' || status === 'archived') {
      return {
        ok: false,
        error: `A ${status.toLowerCase()} proforma can't be converted.`,
      };
    }
    if (!doc.accountId) {
      return {
        ok: false,
        error: 'Link a customer to this proforma before converting it.',
      };
    }
    const lines: DocLineInput[] = (doc.lineItems ?? []).map((l) => ({
      itemId: l.itemId,
      description: l.description,
      qty: l.quantity,
      unit: l.unit,
      rate: l.rate,
      taxRatePct: l.taxPct,
    }));
    if (lines.filter((l) => !isBlankDocLine(l)).length === 0) {
      return { ok: false, error: 'This proforma has no line items to convert.' };
    }

    const numberRes = await getNextSabcrmInvoiceNumber(g.ctx.projectId);
    const invoiceNo = numberRes.ok
      ? numberRes.data
      : `INV-${new Date().getUTCFullYear()}-0001`;
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const created = await createSabcrmInvoiceFull(
      {
        invoiceNo,
        clientId: doc.accountId,
        currency: doc.currency || 'INR',
        date: today,
        dueDate: due,
        lines,
        customerNotes: doc.notes,
        termsAndConditions: (doc.termsAndConditions ?? []).join('\n') || undefined,
        fromKind: 'proforma',
        fromId: id,
      },
      g.ctx.projectId,
    );
    if (!created.ok) return { ok: false, error: created.error };

    // Best-effort status flip — the invoice exists either way.
    try {
      await sabcrmFinanceProformaInvoicesApi.update(g.ctx.projectId, id, {
        status: 'Converted',
      });
    } catch {
      /* recoverable by hand */
    }

    revalidatePath(PROFORMA_PATH);
    return {
      ok: true,
      data: {
        id: created.data._id,
        number: created.data.invoiceNo,
        href: `/sabcrm/finance/invoices/${encodeURIComponent(created.data._id)}`,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to convert the proforma to an invoice.');
  }
}
