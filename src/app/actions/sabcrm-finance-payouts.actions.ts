'use server';

/**
 * SabCRM Finance — payout-surface server actions (spec §3.8).
 *
 * The vendor-side mirror of the payment-receipt surface, mirroring the
 * flagship `sabcrm-finance-invoices.actions.ts` structure:
 *
 *   - display-ready paged list rows (vendor + payment-account labels
 *     batch-resolved server-side — no ObjectIds, no N+1);
 *   - KPI strip (paid this month / uncleared / failed / TDS FY-to-date);
 *   - capped fetch-all for CSV export;
 *   - full-form create/update with REAL picked vendor + bank account
 *     (never a minted placeholder id) and validated `applyTo[]` bill
 *     allocations — on create/update the target bills' statuses flip to
 *     `paid` / `partially_paid` (mirror of `recordSabcrmInvoicePayment`);
 *   - status transitions validated against `SABCRM_PAYOUT_TRANSITIONS`;
 *   - detail context (allocations + lineage rail, all labels resolved).
 *
 * Wire traps handled here:
 *   - `crm-payouts` list is a BARE ARRAY with 1-indexed pages;
 *   - the `PayoutReceipt` entity serializes ObjectId/DateTime fields as
 *     MongoDB extended JSON (`{$oid}` / `{$date}`) — every fetched doc
 *     is deflated via `finance-extjson` before use;
 *   - `UpdateBillInput` cannot patch `amount_paid`/`balance` (server-
 *     managed), so the bill flip is STATUS-ONLY: paid vs partially_paid
 *     is derived from the bill's stored `amountPaid` + this allocation.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings. Engine failures normalise into `{ ok: false, error }`.
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
  sabcrmFinancePaymentAccountsApi,
  sabcrmFinancePayoutsApi,
  type SabcrmBillDoc,
  type SabcrmPayoutCreateInput,
  type SabcrmPayoutDoc,
  type SabcrmPayoutUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmPayoutMode,
  CrmPayoutStatus,
} from '@/lib/rust-client/crm-payouts';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import { resolveSabcrmFinanceVendors } from './sabcrm-finance-pickers.actions';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_PAYOUT_MODES,
  SABCRM_PAYOUT_TRANSITIONS,
  type SabcrmPayoutAllocationInput,
  type SabcrmPayoutAllocationView,
  type SabcrmPayoutFullInput,
  type SabcrmPayoutFullPatch,
  type SabcrmPayoutKpis,
  type SabcrmPayoutListFilters,
  type SabcrmPayoutListPage,
  type SabcrmPayoutListRow,
  type SabcrmPayoutRelatedRef,
} from './sabcrm-finance-payouts.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const FINANCE_PAYOUTS_PATH = '/sabcrm/finance/payouts';

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

/* ─── Validation helpers ──────────────────────────────────────── */

const PAYOUT_MODES: ReadonlySet<CrmPayoutMode> = new Set(
  SABCRM_PAYOUT_MODES.map((m) => m.value),
);

/**
 * Cleans the allocation table: drops blank rows, validates ids and
 * amounts and rejects over-allocation (Σ rows > payout amount).
 */
function cleanAllocations(
  applyTo: SabcrmPayoutAllocationInput[] | undefined,
  amount: number,
):
  | { ok: true; rows: SabcrmPayoutAllocationInput[] }
  | { ok: false; error: string } {
  const rows: SabcrmPayoutAllocationInput[] = [];
  for (const row of applyTo ?? []) {
    if (!row.billId) continue; // unpicked editor row — skip
    if (!ObjectId.isValid(row.billId)) {
      return { ok: false, error: 'An allocation references an invalid bill.' };
    }
    const n = Number(row.amount);
    if (!Number.isFinite(n) || n <= 0) {
      return {
        ok: false,
        error: 'Every bill allocation needs an amount greater than zero.',
      };
    }
    rows.push({ billId: row.billId, amount: round2(n) });
  }
  const allocated = round2(rows.reduce((s, r) => s + r.amount, 0));
  if (allocated > amount + 0.005) {
    return {
      ok: false,
      error: 'The bill allocations exceed the payout amount.',
    };
  }
  return { ok: true, rows };
}

/**
 * Folds an allocation onto its target bills: each bill's status flips
 * to `paid` / `partially_paid` by comparing its stored `amountPaid`
 * plus this allocation against its total. Best-effort — a bill that
 * fails to flip never fails the payout write (`amount_paid` itself is
 * server-managed on the Rust side and not patchable from here).
 */
async function flipBillStatuses(
  projectId: string,
  rows: SabcrmPayoutAllocationInput[],
): Promise<void> {
  await Promise.all(
    rows.map(async (row) => {
      try {
        const bill = deflateDoc<SabcrmBillDoc>(
          await sabcrmFinanceBillsApi.getById(projectId, row.billId),
        );
        const status = (bill.status ?? 'draft') as CrmBillStatus;
        if (status === 'cancelled' || status === 'paid') return;
        const total = bill.totals?.total ?? 0;
        const paidSoFar = bill.amountPaid ?? 0;
        const next: CrmBillStatus =
          paidSoFar + row.amount + 0.005 >= total && total > 0
            ? 'paid'
            : 'partially_paid';
        if (next === status) return;
        await sabcrmFinanceBillsApi.update(projectId, row.billId, {
          status: next,
        });
      } catch {
        // Bill gone / engine hiccup — the payout stands on its own.
      }
    }),
  );
}

/* ─── Numbering ───────────────────────────────────────────────── */

/**
 * Suggests the next payout number from the latest documents: highest
 * numeric suffix + 1, preserving prefix + zero-padding. First payout ⇒
 * `PAY-<year>-0001`.
 */
export async function getNextSabcrmPayoutNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = deflateDocs<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.list(g.ctx.projectId, {
        page: 1,
        limit: 100,
      }),
    );
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of docs) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.paymentNo ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return { ok: true, data: `PAY-${new Date().getUTCFullYear()}-0001` };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a payout number.');
  }
}

/* ─── Label resolution (batched — list rows never show ids) ────── */

/** vendorId → label map via the shared vendor resolver (one batch). */
async function vendorLabelMap(
  ids: string[],
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const res = await resolveSabcrmFinanceVendors(ids, projectId);
  if (res.ok) for (const v of res.data) map.set(v.id, v.label);
  return map;
}

/** accountId → label map from ONE payment-accounts page (≤100 rows). */
async function accountLabelMap(
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(projectId, {
      limit: 100,
    });
    for (const a of res.items) {
      if (a._id) map.set(String(a._id), a.accountName || 'Unnamed account');
    }
  } catch {
    // Accounts engine down — rows render a muted "Unknown account".
  }
  return map;
}

function toListRow(
  doc: SabcrmPayoutDoc,
  vendors: Map<string, string>,
  accounts: Map<string, string>,
): SabcrmPayoutListRow {
  return {
    id: doc._id,
    paymentNo: doc.paymentNo,
    vendorId: doc.vendorId ?? '',
    vendorLabel: doc.vendorId ? (vendors.get(doc.vendorId) ?? null) : null,
    date: doc.date,
    mode: doc.mode,
    bankAccountLabel: doc.bankAccountId
      ? (accounts.get(doc.bankAccountId) ?? null)
      : null,
    amount: doc.amount ?? 0,
    tdsDeducted: doc.tdsDeducted ?? 0,
    currency: doc.currency || 'INR',
    appliedBills: (doc.applyTo ?? []).length,
    reference: doc.reference ?? '',
    status: (doc.status ?? 'sent') as CrmPayoutStatus,
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function inRange(
  docs: SabcrmPayoutDoc[],
  from?: string,
  to?: string,
): SabcrmPayoutDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.date ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page ───────────────────────────────────────────────── */

/**
 * Lists a page of display-ready payout rows. Vendor labels resolve in
 * ONE batch; payment-account labels come from a single accounts page.
 * NB: the crate's list pages are 1-indexed and return a bare array, so
 * `hasMore` derives from a full page (one false-positive "Next" when
 * the total is an exact multiple of the page size).
 */
export async function listSabcrmPayoutsPage(
  filters: SabcrmPayoutListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = deflateDocs<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.list(g.ctx.projectId, {
        page,
        limit,
        q: filters.q || undefined,
        vendorId: filters.vendorId || undefined,
        status: filters.status || undefined,
      }),
    );
    const pageDocs = inRange(docs, filters.from, filters.to);
    const hasMore = docs.length === limit;

    const vendorIds = [
      ...new Set(pageDocs.map((d) => d.vendorId).filter(Boolean)),
    ];
    const [vendors, accounts] = await Promise.all([
      vendorLabelMap(vendorIds, g.ctx.projectId),
      accountLabelMap(g.ctx.projectId),
    ]);

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, vendors, accounts)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list payouts.');
  }
}

/** Pages the list endpoint scans for KPIs / export (100 docs each). */
const SCAN_MAX_PAGES = 5;

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmPayoutRows(
  filters: SabcrmPayoutListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPayoutDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = deflateDocs<SabcrmPayoutDoc>(
        await sabcrmFinancePayoutsApi.list(g.ctx.projectId, {
          page,
          limit: 100,
          q: filters.q || undefined,
          vendorId: filters.vendorId || undefined,
          status: filters.status || undefined,
        }),
      );
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    const rows = inRange(docs, filters.from, filters.to);
    const vendorIds = [...new Set(rows.map((d) => d.vendorId).filter(Boolean))];
    const [vendors, accounts] = await Promise.all([
      vendorLabelMap(vendorIds, g.ctx.projectId),
      accountLabelMap(g.ctx.projectId),
    ]);
    return { ok: true, data: rows.map((d) => toListRow(d, vendors, accounts)) };
  } catch (e) {
    return fail(e, 'Failed to export payouts.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/** First day (`YYYY-MM-DD`) of the current Indian financial year. */
function fyStartKey(now: Date): string {
  const y =
    now.getUTCMonth() + 1 >= 4
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1;
  return `${y}-04-01`;
}

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * payouts). `sampled: true` flags a capped result.
 */
export async function getSabcrmPayoutKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPayoutDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = deflateDocs<SabcrmPayoutDoc>(
        await sabcrmFinancePayoutsApi.list(g.ctx.projectId, {
          page,
          limit: 100,
        }),
      );
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const fyFrom = fyStartKey(now);
    const currencyVotes = new Map<string, number>();
    let paidThisMonth = 0;
    let paidThisMonthCount = 0;
    let unclearedTotal = 0;
    let unclearedCount = 0;
    let failedCount = 0;
    let tdsWithheldFy = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'sent') as CrmPayoutStatus;
      const amount = doc.amount ?? 0;
      const day = (doc.date ?? '').slice(0, 10);
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (status !== 'failed' && day.slice(0, 7) === monthKey) {
        paidThisMonth += amount;
        paidThisMonthCount += 1;
      }
      if (status === 'sent') {
        unclearedTotal += amount;
        unclearedCount += 1;
      }
      if (status === 'failed') failedCount += 1;
      if (status !== 'failed' && day >= fyFrom) {
        tdsWithheldFy += doc.tdsDeducted ?? 0;
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
        paidThisMonth: round2(paidThisMonth),
        paidThisMonthCount,
        unclearedTotal: round2(unclearedTotal),
        unclearedCount,
        failedCount,
        tdsWithheldFy: round2(tdsWithheldFy),
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute payout KPIs.');
  }
}

/* ─── Detail fetch + context ──────────────────────────────────── */

/** Fetches ONE payout, extended-JSON deflated. */
export async function getSabcrmPayoutFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc>> {
  if (!id) return { ok: false, error: 'Payout id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = deflateDoc<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.getById(g.ctx.projectId, id),
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the payout.');
  }
}

/**
 * Builds the detail page's context in one round trip: the resolved
 * vendor + bank-account labels, the allocation table (bill numbers,
 * never ids) and the lineage rail (parent bills).
 */
export async function getSabcrmPayoutContext(
  id: string,
  projectId?: string,
): Promise<
  ActionResult<{
    vendor: DocEntityOption | null;
    bankAccountLabel: string | null;
    allocations: SabcrmPayoutAllocationView[];
    related: SabcrmPayoutRelatedRef[];
  }>
> {
  if (!id) return { ok: false, error: 'Payout id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const payout = deflateDoc<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.getById(g.ctx.projectId, id),
    );

    // Bill ids referenced anywhere (allocations + lineage parents).
    const allocRows = payout.applyTo ?? [];
    const lineageBillIds = (payout.lineage ?? [])
      .filter((l) => l.kind === 'bill')
      .map((l) => l.id);
    const billIds = [
      ...new Set(
        [...allocRows.map((a) => a.billId), ...lineageBillIds].filter(Boolean),
      ),
    ];

    const bills = new Map<string, SabcrmBillDoc>();
    await Promise.all(
      billIds.map(async (billId) => {
        try {
          bills.set(
            billId,
            deflateDoc<SabcrmBillDoc>(
              await sabcrmFinanceBillsApi.getById(g.ctx.projectId, billId),
            ),
          );
        } catch {
          // Bill gone — render a muted "Unknown bill".
        }
      }),
    );

    const billLabel = (b: SabcrmBillDoc | undefined): string | null =>
      b ? b.billNo || b.vendorInvoiceNo || 'Unnumbered bill' : null;

    const allocations: SabcrmPayoutAllocationView[] = allocRows.map((row) => {
      const bill = bills.get(row.billId);
      return {
        billId: row.billId,
        billLabel: billLabel(bill),
        amount: row.amount,
        billStatus: bill?.status,
      };
    });

    const related: SabcrmPayoutRelatedRef[] = billIds.map((billId) => {
      const bill = bills.get(billId);
      return {
        kind: 'bill',
        id: billId,
        label: billLabel(bill) ?? 'Bill',
        href: bill ? '/sabcrm/finance/bills' : null,
        date: bill?.billDate,
        amount: allocRows.find((a) => a.billId === billId)?.amount,
        currency: bill?.currency ?? payout.currency,
        status: bill?.status,
        direction: 'parent',
      };
    });

    const [vendors, accounts] = await Promise.all([
      vendorLabelMap(
        payout.vendorId ? [payout.vendorId] : [],
        g.ctx.projectId,
      ),
      accountLabelMap(g.ctx.projectId),
    ]);

    return {
      ok: true,
      data: {
        vendor: payout.vendorId
          ? {
              id: payout.vendorId,
              label: vendors.get(payout.vendorId) ?? 'Unknown vendor',
            }
          : null,
        bankAccountLabel: payout.bankAccountId
          ? (accounts.get(payout.bankAccountId) ?? null)
          : null,
        allocations,
        related,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the payout context.');
  }
}

/* ─── Full-form create / update ───────────────────────────────── */

/**
 * Creates a payout from the FULL form — real picked vendor + bank
 * account, validated mode, validated bill allocations. After the write
 * the allocated bills' statuses flip to paid / partially_paid. The
 * crate starts every payout in `sent` (its create DTO has no status).
 */
export async function createSabcrmPayoutFull(
  input: SabcrmPayoutFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc>> {
  if (!input?.paymentNo?.trim()) {
    return { ok: false, error: 'A payout number is required.' };
  }
  if (!input.vendorId || !ObjectId.isValid(input.vendorId)) {
    return { ok: false, error: 'Pick the vendor receiving this payout.' };
  }
  if (!PAYOUT_MODES.has(input.mode)) {
    return { ok: false, error: 'Pick a valid payment mode.' };
  }
  if (!input.bankAccountId || !ObjectId.isValid(input.bankAccountId)) {
    return { ok: false, error: 'Pick the account this payout was paid from.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Payout amount must be greater than zero.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid payout date is required.' };
  const chequeIso = input.chequeDate ? toIso(input.chequeDate) : undefined;
  if (input.chequeDate && !chequeIso) {
    return { ok: false, error: 'The cheque date is invalid.' };
  }
  if (input.tdsDeducted !== undefined) {
    const tds = Number(input.tdsDeducted);
    if (!Number.isFinite(tds) || tds < 0 || tds > amount) {
      return {
        ok: false,
        error: 'TDS withheld must be between zero and the payout amount.',
      };
    }
  }
  const alloc = cleanAllocations(input.applyTo, amount);
  if (!alloc.ok) return { ok: false, error: alloc.error };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmPayoutCreateInput = {
      paymentNo: input.paymentNo.trim(),
      date: dateIso,
      vendorId: input.vendorId,
      mode: input.mode,
      bankAccountId: input.bankAccountId,
      amount: round2(amount),
      currency: input.currency.trim().toUpperCase(),
      chequeNo:
        input.mode === 'cheque' ? input.chequeNo?.trim() || undefined : undefined,
      chequeDate: input.mode === 'cheque' ? (chequeIso ?? undefined) : undefined,
      txnId: input.txnId?.trim() || undefined,
      reference: input.reference?.trim() || undefined,
      applyTo: alloc.rows.length > 0 ? alloc.rows : undefined,
      excessAsAdvance: input.excessAsAdvance,
      tdsDeducted:
        input.tdsDeducted !== undefined ? round2(input.tdsDeducted) : undefined,
      notes: input.notes?.trim() || undefined,
      // Lineage seeds from applyTo[0].billId on the Rust side.
    };
    const created = deflateDoc<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.create(g.ctx.projectId, wire),
    );

    await flipBillStatuses(g.ctx.projectId, alloc.rows);

    revalidatePath(FINANCE_PAYOUTS_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create payout.');
  }
}

/**
 * Full-form partial update — the crate's `UpdatePayoutInput` is fully
 * unlocked (spec §3.8), so every form field patches. When `applyTo`
 * changes, the NEW allocation's bills flip status.
 */
export async function updateSabcrmPayoutFull(
  id: string,
  patch: SabcrmPayoutFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc>> {
  if (!id) return { ok: false, error: 'Payout id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmPayoutUpdateInput = {};
  if (patch.paymentNo !== undefined) {
    if (!patch.paymentNo.trim()) {
      return { ok: false, error: 'A payout number is required.' };
    }
    wire.paymentNo = patch.paymentNo.trim();
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The payout date is invalid.' };
    wire.date = iso;
  }
  if (patch.vendorId !== undefined) {
    if (!patch.vendorId || !ObjectId.isValid(patch.vendorId)) {
      return { ok: false, error: 'Pick the vendor receiving this payout.' };
    }
    wire.vendorId = patch.vendorId;
  }
  if (patch.mode !== undefined) {
    if (!PAYOUT_MODES.has(patch.mode)) {
      return { ok: false, error: 'Pick a valid payment mode.' };
    }
    wire.mode = patch.mode;
  }
  if (patch.bankAccountId !== undefined) {
    if (!patch.bankAccountId || !ObjectId.isValid(patch.bankAccountId)) {
      return {
        ok: false,
        error: 'Pick the account this payout was paid from.',
      };
    }
    wire.bankAccountId = patch.bankAccountId;
  }
  let amount: number | undefined;
  if (patch.amount !== undefined) {
    amount = Number(patch.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Payout amount must be greater than zero.' };
    }
    wire.amount = round2(amount);
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.chequeNo !== undefined) wire.chequeNo = patch.chequeNo.trim();
  if (patch.chequeDate !== undefined && patch.chequeDate) {
    const iso = toIso(patch.chequeDate);
    if (!iso) return { ok: false, error: 'The cheque date is invalid.' };
    wire.chequeDate = iso;
  }
  if (patch.txnId !== undefined) wire.txnId = patch.txnId.trim();
  if (patch.reference !== undefined) wire.reference = patch.reference.trim();
  if (patch.excessAsAdvance !== undefined) {
    wire.excessAsAdvance = patch.excessAsAdvance;
  }
  if (patch.tdsDeducted !== undefined) {
    const tds = Number(patch.tdsDeducted);
    if (!Number.isFinite(tds) || tds < 0) {
      return { ok: false, error: 'TDS withheld must be zero or more.' };
    }
    wire.tdsDeducted = round2(tds);
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;

  let allocRows: SabcrmPayoutAllocationInput[] | null = null;
  if (patch.applyTo !== undefined) {
    // Validate against the patched amount when provided, else the
    // stored amount.
    let cap = amount;
    if (cap === undefined) {
      try {
        const current = deflateDoc<SabcrmPayoutDoc>(
          await sabcrmFinancePayoutsApi.getById(g.ctx.projectId, id),
        );
        cap = current.amount ?? 0;
      } catch (e) {
        return fail(e, 'Failed to load the payout.');
      }
    }
    const alloc = cleanAllocations(patch.applyTo, cap);
    if (!alloc.ok) return { ok: false, error: alloc.error };
    wire.applyTo = alloc.rows;
    allocRows = alloc.rows;
  }

  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = deflateDoc<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.update(g.ctx.projectId, id, wire),
    );
    if (allocRows && allocRows.length > 0) {
      await flipBillStatuses(g.ctx.projectId, allocRows);
    }
    revalidatePath(FINANCE_PAYOUTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update payout.');
  }
}

/* ─── Status transitions ──────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map (`sent→cleared/failed`, `failed→sent`;
 * cleared payouts are terminal).
 */
export async function transitionSabcrmPayoutStatus(
  id: string,
  next: CrmPayoutStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc>> {
  if (!id) return { ok: false, error: 'Payout id is required.' };
  if (!(next in SABCRM_PAYOUT_TRANSITIONS)) {
    return { ok: false, error: 'Invalid payout status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = deflateDoc<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.getById(g.ctx.projectId, id),
    );
    const from = (current.status ?? 'sent') as CrmPayoutStatus;
    if (!SABCRM_PAYOUT_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a payout from "${from}" to "${next}".`,
      };
    }
    const data = deflateDoc<SabcrmPayoutDoc>(
      await sabcrmFinancePayoutsApi.update(g.ctx.projectId, id, {
        status: next,
      }),
    );
    revalidatePath(FINANCE_PAYOUTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the payout status.');
  }
}
