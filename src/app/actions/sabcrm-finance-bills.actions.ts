'use server';

/**
 * SabCRM Finance — bill surface server actions.
 *
 * The full doc-surface data paths for `/sabcrm/finance/bills`
 * (finance-rollout spec §3.6), mirroring the flagship
 * `sabcrm-finance-invoices.actions.ts` structure:
 *
 *   - paged display-ready list rows (vendor labels batch-resolved via
 *     the shared pickers — no ObjectIds reach the client, no N+1);
 *   - KPI strip (payable outstanding / overdue / due in 7 days / booked
 *     this month) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update — item lines AND direct-to-ledger expense
 *     lines, totals recomputed server-side from both (client totals are
 *     never trusted); `billNo` is immutable after create per the crate;
 *   - status transitions validated against `SABCRM_BILL_TRANSITIONS`;
 *   - record-payout (creates a `crm-payouts` document with `applyTo` +
 *     `fromKind: 'bill'` lineage back-link, then flips the bill to
 *     `paid` / `partially_paid` by comparing cumulative allocations
 *     against the bill total);
 *   - related-documents rail (PO / GRN / lineage parents + payout and
 *     debit-note children).
 *
 * Engine gap (Rust PR candidate): `Bill.amountPaid` / `balance` are
 * server-managed but no engine path maintains them yet — the payout
 * flow can only flip `status`, so the UI derives the paid total from
 * the payout children instead of trusting the stored fields.
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
  sabcrmFinanceAccountsApi,
  sabcrmFinanceBillsApi,
  sabcrmFinanceDebitNotesApi,
  sabcrmFinancePayoutsApi,
  type SabcrmBillDoc,
  type SabcrmBillUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import {
  sabcrmSupplyGrnsApi,
  sabcrmSupplyPurchaseOrdersApi,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmBillExpenseLine,
  CrmBillLineItem,
  CrmBillStatus,
  CrmBillTotals,
} from '@/lib/rust-client/crm-bills';
import type { CrmPayoutMode } from '@/lib/rust-client/crm-payouts';
import {
  computeDocGrandTotals,
  isBlankDocLine,
  round2,
  safeNum,
  type DocLineInput,
  type DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import { resolveSabcrmFinanceVendors } from './sabcrm-finance-pickers.actions';
import type { SabcrmRelatedDocRef } from './sabcrm-finance-invoices.actions.types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_BILL_OPEN_STATUSES,
  SABCRM_BILL_PAYABLE_STATUSES,
  SABCRM_BILL_TRANSITIONS,
  type SabcrmBillExpenseLineInput,
  type SabcrmBillFullInput,
  type SabcrmBillFullPatch,
  type SabcrmBillKpis,
  type SabcrmBillListFilters,
  type SabcrmBillListPage,
  type SabcrmBillListRow,
  type SabcrmBillPayoutInput,
} from './sabcrm-finance-bills.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const BILLS_PATH = '/sabcrm/finance/bills';

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

/* ─── Vocabulary ──────────────────────────────────────────────── */

const OPEN_STATUSES: ReadonlySet<CrmBillStatus> = new Set(
  SABCRM_BILL_OPEN_STATUSES,
);

const PAYABLE_STATUSES: ReadonlySet<CrmBillStatus> = new Set(
  SABCRM_BILL_PAYABLE_STATUSES,
);

const PAYOUT_MODES: ReadonlySet<CrmPayoutMode> = new Set([
  'cash',
  'cheque',
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
]);

/* ─── Numbering ────────────────────────────────────────────────── */

/**
 * Suggests the next bill number from the latest documents: takes the
 * highest numeric suffix among existing numbers and increments it,
 * preserving prefix + zero-padding. First bill ⇒ `BILL-<year>-0001`.
 */
export async function getNextSabcrmBillNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceBillsApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of docs) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.billNo ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return { ok: true, data: `BILL-${new Date().getUTCFullYear()}-0001` };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a bill number.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Pages the list endpoint scans for KPIs (100 docs each). */
const KPI_MAX_PAGES = 5;

/** Days from `dueIso` to today (UTC midnights); positive ⇒ past due. */
function agingDaysFor(dueIso: string | undefined): number | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return null;
  const ms =
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ) - Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.round(ms / 86_400_000);
}

/** Outstanding balance for display (0 once `paid`). */
function balanceOf(doc: SabcrmBillDoc): number {
  const status = (doc.status ?? 'draft') as CrmBillStatus;
  if (status === 'paid') return 0;
  const total = doc.totals?.total ?? 0;
  return doc.balance ?? total - (doc.amountPaid ?? 0);
}

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * bills). `sampled: true` flags a capped result.
 */
export async function getSabcrmBillKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmBillKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmBillDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceBillsApi.list(g.ctx.projectId, {
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
    let outstanding = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let dueSoonAmount = 0;
    let thisMonthTotal = 0;
    let thisMonthCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as CrmBillStatus;
      const total = doc.totals?.total ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (OPEN_STATUSES.has(status)) {
        const balance = Math.max(0, balanceOf(doc));
        outstanding += balance;
        const aging = agingDaysFor(doc.dueDate);
        if (status === 'overdue' || (aging !== null && aging > 0)) {
          overdueCount += 1;
        } else if (aging !== null && aging >= -7) {
          // Due within the next 7 days (aging is negative until due).
          dueSoonCount += 1;
          dueSoonAmount += balance;
        }
      }
      if (
        (doc.billDate ?? '').slice(0, 7) === monthKey &&
        status !== 'cancelled'
      ) {
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

    return {
      ok: true,
      data: {
        currency,
        outstanding: round2(outstanding),
        overdueCount,
        dueSoonCount,
        dueSoonAmount: round2(dueSoonAmount),
        thisMonthTotal: round2(thisMonthTotal),
        thisMonthCount,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute bill KPIs.');
  }
}

/* ─── List page (display-ready rows) ───────────────────────────── */

function toListRow(
  doc: SabcrmBillDoc,
  vendorMap: Map<string, DocEntityOption>,
): SabcrmBillListRow {
  const status = (doc.status ?? 'draft') as CrmBillStatus;
  const total = doc.totals?.total ?? 0;
  const vendor = doc.vendorId ? vendorMap.get(doc.vendorId) : undefined;
  const open = OPEN_STATUSES.has(status);
  return {
    id: doc._id,
    number: doc.billNo || doc.vendorInvoiceNo || 'Unnumbered',
    billNo: doc.billNo ?? null,
    vendorInvoiceNo: doc.vendorInvoiceNo ?? null,
    vendorId: doc.vendorId ?? '',
    vendorLabel: vendor?.label ?? null,
    billDate: doc.billDate,
    dueDate: doc.dueDate ?? null,
    currency: doc.currency,
    total,
    amountPaid: doc.amountPaid ?? 0,
    balance: balanceOf(doc),
    status,
    agingDays: open ? agingDaysFor(doc.dueDate) : null,
  };
}

/** Batch-resolves the page's vendor ids into a label map (no N+1). */
async function vendorMapFor(
  docs: SabcrmBillDoc[],
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
 * Lists a page of display-ready bill rows and resolves all vendor
 * labels in one batched pass. Date-range filtering is applied here (the
 * crate's ListQuery has no `from`/`to`).
 *
 * Pagination: exactly `limit` rows are requested (the Rust skip math
 * uses the requested limit); `hasMore` derives from a full page.
 */
export async function listSabcrmBillsPage(
  filters: SabcrmBillListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBillListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinanceBillsApi.list(g.ctx.projectId, {
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
        const day = (d.billDate ?? '').slice(0, 10);
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
    return fail(e, 'Failed to list bills.');
  }
}

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmBillRows(
  filters: SabcrmBillListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBillListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmBillDoc[] = [];
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceBillsApi.list(g.ctx.projectId, {
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
        const day = (d.billDate ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }
    const vendorMap = await vendorMapFor(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, vendorMap)) };
  } catch (e) {
    return fail(e, 'Failed to export bills.');
  }
}

/* ─── Single document ──────────────────────────────────────────── */

/**
 * Fetches one bill plus the resolved chart-of-accounts labels for its
 * expense lines (the detail paper renders account NAMES, never ids).
 */
export async function getSabcrmBillFull(
  id: string,
  projectId?: string,
): Promise<
  ActionResult<{ doc: SabcrmBillDoc; expenseAccounts: DocEntityOption[] }>
> {
  if (!id) return { ok: false, error: 'Bill id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinanceBillsApi.getById(g.ctx.projectId, id);
    const accountIds = [
      ...new Set(
        (doc.expenseLines ?? [])
          .map((l) => l.accountId)
          .filter((v): v is string => !!v),
      ),
    ];
    const expenseAccounts: DocEntityOption[] = [];
    await Promise.all(
      accountIds.map(async (accountId) => {
        try {
          const account = await sabcrmFinanceAccountsApi.getById(
            g.ctx.projectId,
            accountId,
          );
          expenseAccounts.push({
            id: accountId,
            label: account.name,
            meta:
              [account.code, account.accountType].filter(Boolean).join(' · ') ||
              undefined,
          });
        } catch {
          // Account gone — the line renders its description alone.
        }
      }),
    );
    return { ok: true, data: { doc, expenseAccounts } };
  } catch (e) {
    return fail(e, 'Failed to load the bill.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

interface BillWireMoney {
  items: CrmBillLineItem[];
  expenseLines: CrmBillExpenseLine[];
  totals: CrmBillTotals;
}

/**
 * Builds the wire `items` + `expenseLines` + `totals` from the form —
 * authoritative server recompute. Item lines roll up via the shared
 * `computeDocGrandTotals` (incl. header modifiers); expense lines add
 * `amount` to the subtotal and `amount × taxRatePct%` to the tax.
 * Returns an error string for invalid money, null when both line sets
 * are empty.
 */
function buildBillMoney(
  lines: DocLineInput[],
  expenseLines: SabcrmBillExpenseLineInput[] | undefined,
  modifiers?: DocTotalsModifiersInput,
): BillWireMoney | null | { error: string } {
  const meaningful = (lines ?? []).filter((l) => !isBlankDocLine(l));
  const expenses = (expenseLines ?? []).filter(
    (l) =>
      safeNum(l.amount) > 0 || (l.description ?? '').trim() || l.accountId,
  );
  if (meaningful.length === 0 && expenses.length === 0) return null;

  for (const line of expenses) {
    if (!Number.isFinite(line.amount) || line.amount <= 0) {
      return { error: 'Every expense line needs an amount above zero.' };
    }
    if (line.accountId && !ObjectId.isValid(line.accountId)) {
      return { error: 'An expense line has an invalid ledger account.' };
    }
  }

  const computed = computeDocGrandTotals(meaningful, modifiers);
  let expenseSub = 0;
  let expenseTax = 0;
  const wireExpenses: CrmBillExpenseLine[] = expenses.map((l) => {
    const amount = round2(safeNum(l.amount));
    const taxRatePct =
      l.taxRatePct === undefined ? undefined : safeNum(l.taxRatePct);
    expenseSub += amount;
    expenseTax += taxRatePct ? (amount * taxRatePct) / 100 : 0;
    return {
      accountId: l.accountId || undefined,
      description: l.description?.trim() || undefined,
      amount,
      taxRatePct,
    };
  });

  const total = round2(computed.grandTotal + expenseSub + round2(expenseTax));
  if (total < 0) {
    return { error: 'The adjustments push the total below zero.' };
  }

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
    expenseLines: wireExpenses,
    totals: {
      subTotal: round2(computed.subTotal + expenseSub),
      discountOverall: computed.discountOverall || undefined,
      shippingCharge: computed.shippingCharge || undefined,
      adjustment: computed.adjustment || undefined,
      roundOff: computed.roundOff || undefined,
      total,
    },
  };
}

/** Validates the optional FX / TDS numeric fields. */
function cleanPositive(
  v: number | undefined,
  label: string,
  allowZero = false,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
    return { ok: false, error: `${label} must be a positive number.` };
  }
  return { ok: true, value: round2(n) };
}

/**
 * Creates a bill from the FULL doc form — real picked vendor, item +
 * expense lines, server-computed totals, TDS / reverse-charge / FX
 * header, optional lineage parent, optional immediate submit.
 */
export async function createSabcrmBillFull(
  input: SabcrmBillFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc>> {
  if (!input?.billNo?.trim()) {
    return { ok: false, error: 'A bill number is required.' };
  }
  if (!input.vendorId || !ObjectId.isValid(input.vendorId)) {
    return { ok: false, error: 'Pick a vendor for this bill.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.billDate ? toIso(input.billDate) : null;
  if (!dateIso) return { ok: false, error: 'A valid bill date is required.' };
  let dueIso: string | undefined;
  if (input.dueDate) {
    const iso = toIso(input.dueDate);
    if (!iso) return { ok: false, error: 'The due date is invalid.' };
    if (iso < dateIso) {
      return { ok: false, error: "The due date can't be before the bill date." };
    }
    dueIso = iso;
  }
  const money = buildBillMoney(
    input.lines ?? [],
    input.expenseLines,
    input.totalsModifiers,
  );
  if (money === null) {
    return {
      ok: false,
      error: 'Add at least one item line or expense line.',
    };
  }
  if ('error' in money) return { ok: false, error: money.error };
  const fx = cleanPositive(input.exchangeRate, 'Exchange rate');
  if (!fx.ok) return { ok: false, error: fx.error };
  const tds = cleanPositive(input.tdsAmount, 'TDS amount', true);
  if (!tds.ok) return { ok: false, error: tds.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceBillsApi.create(g.ctx.projectId, {
      billNo: input.billNo.trim(),
      vendorInvoiceNo: input.vendorInvoiceNo?.trim() || undefined,
      billDate: dateIso,
      dueDate: dueIso,
      vendorId: input.vendorId,
      items: money.items.length > 0 ? money.items : undefined,
      expenseLines:
        money.expenseLines.length > 0 ? money.expenseLines : undefined,
      tdsSection: input.tdsSection?.trim() || undefined,
      tdsAmount: tds.value,
      reverseCharge: input.reverseCharge,
      placeOfSupply: input.placeOfSupply?.trim() || undefined,
      currency: input.currency.trim().toUpperCase(),
      exchangeRate: fx.value,
      totals: money.totals,
      notes: input.notes?.trim() || undefined,
      fromKind: input.fromKind,
      fromId:
        input.fromId && ObjectId.isValid(input.fromId)
          ? input.fromId
          : undefined,
    });

    // The create DTO has no `status` — "save & submit" is a follow-up
    // PATCH (the proving-vertical pattern).
    let result = created;
    if (input.issue) {
      result = await sabcrmFinanceBillsApi.update(
        g.ctx.projectId,
        created._id,
        { status: 'submitted' },
      );
    }

    revalidatePath(BILLS_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create the bill.');
  }
}

/**
 * Full-form partial update. `billNo` is immutable at the crate layer
 * (stable AP doc numbers) — the edit drawer rejects changed numbers
 * client-side and this patch shape can't carry one.
 */
export async function updateSabcrmBillFull(
  id: string,
  patch: SabcrmBillFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc>> {
  if (!id) return { ok: false, error: 'Bill id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmBillUpdateInput = {};
  if (patch.vendorInvoiceNo !== undefined) {
    wire.vendorInvoiceNo = patch.vendorInvoiceNo.trim();
  }
  if (patch.vendorId !== undefined) {
    if (!patch.vendorId || !ObjectId.isValid(patch.vendorId)) {
      return { ok: false, error: 'Pick a vendor for this bill.' };
    }
    wire.vendorId = patch.vendorId;
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.exchangeRate !== undefined) {
    const fx = cleanPositive(patch.exchangeRate, 'Exchange rate');
    if (!fx.ok) return { ok: false, error: fx.error };
    wire.exchangeRate = fx.value;
  }
  if (patch.billDate !== undefined) {
    const iso = toIso(patch.billDate);
    if (!iso) return { ok: false, error: 'The bill date is invalid.' };
    wire.billDate = iso;
  }
  if (patch.dueDate !== undefined) {
    if (patch.dueDate) {
      const iso = toIso(patch.dueDate);
      if (!iso) return { ok: false, error: 'The due date is invalid.' };
      wire.dueDate = iso;
    }
    // NB: clearing a stored due date isn't expressible on the wire
    // (Option<DateTime> with absent-means-unchanged) — empty input
    // leaves the existing value in place.
  }
  if (patch.lines !== undefined || patch.expenseLines !== undefined) {
    // Item + expense lines ride together — totals recompute from both
    // in one pass (the form always submits the full money picture).
    if (patch.lines === undefined || patch.expenseLines === undefined) {
      return {
        ok: false,
        error: 'Item and expense lines must be updated together.',
      };
    }
    const money = buildBillMoney(
      patch.lines,
      patch.expenseLines,
      patch.totalsModifiers,
    );
    if (money === null) {
      return {
        ok: false,
        error: 'Add at least one item line or expense line.',
      };
    }
    if ('error' in money) return { ok: false, error: money.error };
    wire.items = money.items;
    wire.expenseLines = money.expenseLines;
    wire.totals = money.totals;
  } else if (patch.totalsModifiers !== undefined) {
    return {
      ok: false,
      error: 'Totals modifiers can only be updated together with line items.',
    };
  }
  if (patch.tdsSection !== undefined) wire.tdsSection = patch.tdsSection.trim();
  if (patch.tdsAmount !== undefined) {
    const tds = cleanPositive(patch.tdsAmount, 'TDS amount', true);
    if (!tds.ok) return { ok: false, error: tds.error };
    wire.tdsAmount = tds.value;
  }
  if (patch.reverseCharge !== undefined) {
    wire.reverseCharge = patch.reverseCharge;
  }
  if (patch.placeOfSupply !== undefined) {
    wire.placeOfSupply = patch.placeOfSupply.trim();
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceBillsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(BILLS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the bill.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map (e.g. a paid bill is terminal;
 * `paid`/`partially_paid` arrive via `recordSabcrmBillPayout`).
 */
export async function transitionSabcrmBillStatus(
  id: string,
  next: CrmBillStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc>> {
  if (!id) return { ok: false, error: 'Bill id is required.' };
  if (!(next in SABCRM_BILL_TRANSITIONS)) {
    return { ok: false, error: 'Invalid bill status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceBillsApi.getById(g.ctx.projectId, id);
    const from = (current.status ?? 'draft') as CrmBillStatus;
    if (!SABCRM_BILL_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a bill from "${from.replace('_', ' ')}" to "${next.replace('_', ' ')}".`,
      };
    }
    const data = await sabcrmFinanceBillsApi.update(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(BILLS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the bill status.');
  }
}

/* ─── Payouts ──────────────────────────────────────────────────── */

/**
 * Σ amounts already allocated to this bill across the vendor's
 * non-failed payouts (the engine doesn't maintain `Bill.amountPaid`
 * yet — allocations are the source of truth).
 */
async function paidSoFar(
  projectId: string,
  billId: string,
  vendorId: string | undefined,
): Promise<number> {
  if (!vendorId) return 0;
  try {
    const payouts = await sabcrmFinancePayoutsApi.list(projectId, {
      vendorId,
      limit: 100,
    });
    let sum = 0;
    for (const payout of payouts) {
      if (payout.status === 'failed') continue;
      for (const application of payout.applyTo ?? []) {
        if (application.billId === billId) sum += application.amount;
      }
    }
    return round2(sum);
  } catch {
    return 0;
  }
}

/**
 * Records a payout against a bill (finance-rollout spec §3.6):
 *   1. creates a `crm-payouts` document with `applyTo: [{billId,
 *      amount}]` + `fromKind: 'bill'` (which back-links the payout into
 *      the bill's lineage on the Rust side);
 *   2. flips the bill to `paid` / `partially_paid` by comparing the
 *      CUMULATIVE allocations (existing + this one) against the bill
 *      total — `Bill.amountPaid` itself is server-managed and not yet
 *      writable, so allocations are the source of truth.
 *
 * The bank account is a REAL picked payment account — never minted.
 */
export async function recordSabcrmBillPayout(
  id: string,
  input: SabcrmBillPayoutInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc>> {
  if (!id) return { ok: false, error: 'Bill id is required.' };
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Payout amount must be greater than zero.' };
  }
  if (!PAYOUT_MODES.has(input.mode)) {
    return { ok: false, error: 'Pick a valid payout mode.' };
  }
  if (!input.bankAccountId || !ObjectId.isValid(input.bankAccountId)) {
    return { ok: false, error: 'Pick the account this payout left from.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid payout date is required.' };
  const tds = cleanPositive(input.tdsDeducted, 'TDS withheld', true);
  if (!tds.ok) return { ok: false, error: tds.error };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const bill = await sabcrmFinanceBillsApi.getById(g.ctx.projectId, id);
    const status = (bill.status ?? 'draft') as CrmBillStatus;
    if (!PAYABLE_STATUSES.has(status)) {
      const why =
        status === 'paid'
          ? 'This bill is already fully paid.'
          : status === 'cancelled'
            ? "Can't record a payout on a cancelled bill."
            : 'Approve the bill before recording a payout.';
      return { ok: false, error: why };
    }

    const previouslyPaid = await paidSoFar(g.ctx.projectId, id, bill.vendorId);

    const day = dateIso.slice(0, 10).replaceAll('-', '');
    const paymentNo = `PAY-${day}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    await sabcrmFinancePayoutsApi.create(g.ctx.projectId, {
      paymentNo,
      date: dateIso,
      vendorId: bill.vendorId,
      mode: input.mode,
      bankAccountId: input.bankAccountId,
      amount: round2(amount),
      currency: bill.currency,
      reference: input.reference?.trim() || undefined,
      tdsDeducted: tds.value,
      notes: input.notes?.trim() || undefined,
      applyTo: [{ billId: id, amount: round2(amount) }],
      fromKind: 'bill',
      fromId: id,
    });

    const total = bill.totals?.total ?? 0;
    const newPaid = round2(previouslyPaid + amount);
    const nextStatus: CrmBillStatus =
      newPaid + 0.005 >= total ? 'paid' : 'partially_paid';

    const data = await sabcrmFinanceBillsApi.update(g.ctx.projectId, id, {
      status: nextStatus,
    });
    revalidatePath(BILLS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to record the payout.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: PARENTS (linked PO, GRNs and the
 * lineage chain, resolved to their doc numbers) + CHILDREN (payouts
 * applied to this bill and debit notes raised against it). The payout
 * children double as the bill's paid-total source for the detail page.
 */
export async function getSabcrmBillRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Bill id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const bill = await sabcrmFinanceBillsApi.getById(g.ctx.projectId, id);
    const out: SabcrmRelatedDocRef[] = [];
    const seen = new Set<string>();

    /* ---- parents ---- */
    const parentRefs: { kind: string; id: string }[] = [
      ...(bill.linkedPoId
        ? [{ kind: 'purchaseOrder', id: bill.linkedPoId }]
        : []),
      ...(bill.linkedGrnIds ?? []).map((grnId) => ({ kind: 'grn', id: grnId })),
      ...(bill.lineage ?? []),
    ];

    await Promise.all(
      parentRefs.map(async (ref) => {
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
        try {
          if (ref.kind === 'purchaseOrder') {
            const doc = await sabcrmSupplyPurchaseOrdersApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.poNo ?? base.label;
            base.href = '/sabcrm/supply/purchase-orders';
            base.status = doc.status;
          } else if (ref.kind === 'grn') {
            const doc = await sabcrmSupplyGrnsApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.grnNo ?? base.label;
            base.href = '/sabcrm/supply/grn';
            base.status = doc.status;
          }
        } catch {
          // Parent gone — keep the humanised kind, no link.
        }
        out.push(base);
      }),
    );

    /* ---- children: payouts applied to this bill ---- */
    try {
      const payouts = await sabcrmFinancePayoutsApi.list(g.ctx.projectId, {
        vendorId: bill.vendorId,
        limit: 100,
      });
      for (const payout of payouts) {
        const applied = (payout.applyTo ?? []).find((a) => a.billId === id);
        const linked = (payout.lineage ?? []).some(
          (l) => l.kind === 'bill' && l.id === id,
        );
        if (!applied && !linked) continue;
        out.push({
          kind: 'payout',
          id: payout._id,
          label: payout.paymentNo,
          href: '/sabcrm/finance/payouts',
          date: payout.date,
          amount: applied?.amount ?? payout.amount,
          currency: payout.currency,
          status: payout.status,
          direction: 'child',
        });
      }
    } catch {
      // Payout engine down — the rest of the rail still renders.
    }

    /* ---- children: debit notes raised against this bill ---- */
    try {
      const notes = await sabcrmFinanceDebitNotesApi.list(g.ctx.projectId, {
        vendorId: bill.vendorId,
        limit: 100,
      });
      for (const note of notes) {
        const linked =
          note.linkedBillId === id ||
          (note.lineage ?? []).some((l) => l.kind === 'bill' && l.id === id);
        if (!linked) continue;
        out.push({
          kind: 'debitNote',
          id: note._id,
          label: note.dnNo,
          href: `/sabcrm/finance/debit-notes/${encodeURIComponent(note._id)}`,
          date: note.date,
          amount: note.totals?.total,
          currency: note.currency,
          status: note.status,
          direction: 'child',
        });
      }
    } catch {
      // Debit-note engine down — the rest of the rail still renders.
    }

    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}
