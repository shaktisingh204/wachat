'use server';

/**
 * SabCRM Finance — accounting statements + India tax read computations.
 *
 * Tranche 3 of the SabCRM Finance suite. The legacy CRM computed these
 * reports in `crm-accounting-reports.actions.ts` / `crm-india-gst.*`
 * over the LEGACY `userId`-scoped Mongo collections (different field
 * names, a report engine, portal imports). Re-scoping those wholesale
 * would mix tenancy models, so instead this module derives each
 * statement directly from the PROJECT-scoped finance documents served
 * by the `/v1/sabcrm/finance/*` Rust mounts (tranches 1-3):
 *
 *   - Trial balance  — chart-of-accounts opening balances + posted
 *     journal-entry debit/credit lines.
 *   - P&L            — invoices (revenue) vs bills + expense claims.
 *   - Balance sheet  — cash (receipts − payouts − expenses), AR
 *     (invoice balances), AP (bill balances); retained earnings is the
 *     derived balancing figure.
 *   - Cash flow      — monthly receipts vs payouts + expenses.
 *   - GST            — GSTR-1-style outward summary by GST treatment +
 *     GSTR-3B-style outward tax vs ITC (from bill line taxes).
 *   - E-way bills    — invoices carrying `ewayBillNo` + invoices over
 *     the ₹50,000 consignment threshold still missing one.
 *
 * SIMPLIFICATIONS (documented for the report pages):
 *   - Amounts are summed across currencies as-is (single-currency
 *     books assumed; the suite defaults to INR).
 *   - Drafts and cancelled/archived documents are excluded everywhere.
 *   - Each source list is paged to a hard cap (10 × 100 docs) — beyond
 *     that the statement is computed over the first 1,000 documents.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * `sabcrm-finance.actions.ts` and is strictly read-only ('view').
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceApi,
  sabcrmFinanceBillsApi,
  sabcrmFinancePaymentReceiptsApi,
  sabcrmFinancePayoutsApi,
  sabcrmFinanceExpensesApi,
  sabcrmFinanceAccountsApi,
  sabcrmFinanceJournalEntriesApi,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  SabcrmInvoiceDoc,
  SabcrmBillDoc,
  SabcrmPaymentReceiptDoc,
  SabcrmPayoutDoc,
  SabcrmExpenseClaimDoc,
  SabcrmChartOfAccountDoc,
  SabcrmJournalEntryDoc,
} from '@/lib/rust-client/sabcrm-finance';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmTrialBalance,
  SabcrmTrialBalanceRow,
  SabcrmPnl,
  SabcrmPnlMonth,
  SabcrmBalanceSheet,
  SabcrmCashFlow,
  SabcrmCashFlowMonth,
  SabcrmGstSummary,
  SabcrmGstr1Row,
  SabcrmEwayReadiness,
  SabcrmEwayRow,
} from './sabcrm-statements.actions.types';

// ---------------------------------------------------------------------------
// Gate (mirrors sabcrm-finance.actions.ts verbatim)
// ---------------------------------------------------------------------------

const MODULE_KEY = 'sabcrm';

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
  const projectId = requested;

  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Paged fetch helpers (Rust clamps limit to 100 per page)
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

/**
 * Drain a bare-array list endpoint. NB: the invoices-style crates
 * (invoices/bills/receipts/payouts) use 1-INDEXED pages
 * (`page.unwrap_or(1)`), unlike the crm-common crates.
 */
async function drainArray<T>(
  fetchPage: (page: number, limit: number) => Promise<T[]>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const rows = await fetchPage(page, PAGE_LIMIT);
    all.push(...rows);
    if (rows.length < PAGE_LIMIT) break;
  }
  return all;
}

/**
 * Drain an `{ items, hasMore }` list endpoint. NB: crm-common-style
 * crates use 0-INDEXED pages (`skip_for` with `page.unwrap_or(0)`).
 */
async function drainItems<T>(
  fetchPage: (
    page: number,
    limit: number,
  ) => Promise<{ items: T[]; hasMore: boolean }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await fetchPage(page, PAGE_LIMIT);
    all.push(...res.items);
    if (!res.hasMore) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Shared numeric/date helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Parse an ISO instant/date defensively; `null` when unparseable. */
function parseDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Documents excluded from every statement. */
const EXCLUDED_DOC_STATUSES = new Set(['draft', 'cancelled', 'archived']);

/** Strict `YYYY-MM-DD`; everything else is treated as "no cut-off". */
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalise an `asOf` page param; `undefined` when absent/garbage. */
function asOfDayKey(asOf: string | undefined): string | undefined {
  return asOf && DAY_KEY_RE.test(asOf) ? asOf : undefined;
}

/**
 * UTC day-key cut-off check. Docs without a parsable date are KEPT
 * (matching the all-time behaviour, where undated docs still count).
 */
function onOrBefore(iso: string | undefined, asOfDay: string | undefined): boolean {
  if (!asOfDay) return true;
  if (!iso) return true;
  const day = iso.slice(0, 10);
  return !DAY_KEY_RE.test(day) || day <= asOfDay;
}

function invoiceCounts(inv: SabcrmInvoiceDoc): boolean {
  return !EXCLUDED_DOC_STATUSES.has(String(inv.status ?? ''));
}

function billCounts(bill: SabcrmBillDoc): boolean {
  if (bill.archived) return false;
  return !EXCLUDED_DOC_STATUSES.has(String(bill.status ?? ''));
}

function receiptCounts(r: SabcrmPaymentReceiptDoc): boolean {
  if (r.archived) return false;
  return String(r.status ?? '') !== 'bounced';
}

/** Approved/reimbursed claims are real spend; drafts/rejections aren't. */
function expenseCounts(e: SabcrmExpenseClaimDoc): boolean {
  return e.status === 'approved' || e.status === 'reimbursed';
}

function expenseDate(e: SabcrmExpenseClaimDoc): Date | null {
  return parseDate(e.expense_date ?? e.createdAt);
}

/** Σ of a tax bucket across an invoice/bill's line items. */
function lineTax(
  items: Array<{
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    cessAmount?: number;
  }> | undefined,
): { cgst: number; sgst: number; igst: number; cess: number } {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  for (const it of items ?? []) {
    cgst += num(it.cgstAmount);
    sgst += num(it.sgstAmount);
    igst += num(it.igstAmount);
    cess += num(it.cessAmount);
  }
  return { cgst, sgst, igst, cess };
}

// ---------------------------------------------------------------------------
// Source fetchers (project-scoped)
// ---------------------------------------------------------------------------

function fetchInvoices(projectId: string): Promise<SabcrmInvoiceDoc[]> {
  return drainArray((page, limit) =>
    sabcrmFinanceApi.listInvoices(projectId, { page, limit }),
  );
}

function fetchBills(projectId: string): Promise<SabcrmBillDoc[]> {
  return drainArray((page, limit) =>
    sabcrmFinanceBillsApi.list(projectId, { page, limit }),
  );
}

function fetchReceipts(
  projectId: string,
): Promise<SabcrmPaymentReceiptDoc[]> {
  return drainArray((page, limit) =>
    sabcrmFinancePaymentReceiptsApi.list(projectId, { page, limit }),
  );
}

function fetchPayouts(projectId: string): Promise<SabcrmPayoutDoc[]> {
  return drainArray((page, limit) =>
    sabcrmFinancePayoutsApi.list(projectId, { page, limit }),
  );
}

function fetchExpenses(
  projectId: string,
): Promise<SabcrmExpenseClaimDoc[]> {
  return drainItems((page, limit) =>
    sabcrmFinanceExpensesApi.list(projectId, { page, limit }),
  );
}

function fetchAccounts(
  projectId: string,
): Promise<SabcrmChartOfAccountDoc[]> {
  return drainItems((page, limit) =>
    sabcrmFinanceAccountsApi.list(projectId, { page, limit }),
  );
}

function fetchPostedEntries(
  projectId: string,
): Promise<SabcrmJournalEntryDoc[]> {
  return drainItems((page, limit) =>
    sabcrmFinanceJournalEntriesApi.list(projectId, {
      page,
      limit,
      status: 'posted',
    }),
  );
}

// ---------------------------------------------------------------------------
// Trial balance
// ---------------------------------------------------------------------------

const BALANCE_TOLERANCE = 0.01;

/**
 * Trial balance over the project's chart of accounts: each ledger
 * head's opening balance plus its posted journal-entry movement.
 * `asOf` (`YYYY-MM-DD`) excludes journal entries dated after the
 * cut-off — the month-end PeriodSwitcher on the report page.
 */
export async function getSabcrmTrialBalance(
  asOf?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmTrialBalance>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const asOfDay = asOfDayKey(asOf);

  try {
    const [accounts, allEntries] = await Promise.all([
      fetchAccounts(g.ctx.projectId),
      fetchPostedEntries(g.ctx.projectId),
    ]);
    const entries = asOfDay
      ? allEntries.filter((e) => onOrBefore(e.date, asOfDay))
      : allEntries;

    const debits = new Map<string, number>();
    const credits = new Map<string, number>();
    for (const entry of entries) {
      for (const line of entry.debitEntries ?? []) {
        debits.set(
          line.accountId,
          (debits.get(line.accountId) ?? 0) + num(line.amount),
        );
      }
      for (const line of entry.creditEntries ?? []) {
        credits.set(
          line.accountId,
          (credits.get(line.accountId) ?? 0) + num(line.amount),
        );
      }
    }

    const rows: SabcrmTrialBalanceRow[] = accounts.map((a) => {
      const totalDebit = round2(debits.get(a._id) ?? 0);
      const totalCredit = round2(credits.get(a._id) ?? 0);
      const openingBalance = round2(num(a.openingBalance));
      return {
        accountId: a._id,
        name: a.name,
        code: a.code,
        accountType: a.accountType,
        openingBalance,
        totalDebit,
        totalCredit,
        closing: round2(openingBalance + totalDebit - totalCredit),
      };
    });
    rows.sort((x, y) => x.name.localeCompare(y.name));

    let totalDebit = 0;
    let totalCredit = 0;
    for (const r of rows) {
      if (r.closing >= 0) totalDebit += r.closing;
      else totalCredit += -r.closing;
    }
    totalDebit = round2(totalDebit);
    totalCredit = round2(totalCredit);

    return {
      ok: true,
      data: {
        rows,
        totalDebit,
        totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) <= BALANCE_TOLERANCE,
        entryCount: entries.length,
        asOf: asOfDay,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute the trial balance.');
  }
}

// ---------------------------------------------------------------------------
// Profit & loss (Indian FY: Apr → Mar)
// ---------------------------------------------------------------------------

/** FY start year for a date (Apr-Mar). */
function fyStartYear(d: Date): number {
  return d.getUTCMonth() + 1 >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

function fyLabelFor(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** One FY's P&L over already-fetched documents (sync, reusable for compare). */
function computePnlForFy(
  startYear: number,
  invoices: SabcrmInvoiceDoc[],
  bills: SabcrmBillDoc[],
  expenses: SabcrmExpenseClaimDoc[],
): Omit<SabcrmPnl, 'previous'> {
  // 12 buckets Apr..Mar.
  const months: SabcrmPnlMonth[] = Array.from({ length: 12 }, (_, i) => {
    const m = (3 + i) % 12; // Apr = index 3
    const y = m >= 3 ? startYear : startYear + 1;
    return {
      month: `${MONTHS[m]} ${y}`,
      revenue: 0,
      expenses: 0,
      bills: 0,
      claims: 0,
      net: 0,
    };
  });

  const bucketIndex = (d: Date): number => {
    if (fyStartYear(d) !== startYear) return -1;
    const m = d.getUTCMonth(); // 0-11
    return m >= 3 ? m - 3 : m + 9;
  };

  let totalRevenue = 0;
  for (const inv of invoices) {
    if (!invoiceCounts(inv)) continue;
    const d = parseDate(inv.date);
    if (!d) continue;
    const idx = bucketIndex(d);
    if (idx < 0) continue;
    const amt = num(inv.totals?.total);
    months[idx].revenue += amt;
    totalRevenue += amt;
  }

  let totalBills = 0;
  for (const bill of bills) {
    if (!billCounts(bill)) continue;
    const d = parseDate(bill.billDate);
    if (!d) continue;
    const idx = bucketIndex(d);
    if (idx < 0) continue;
    const amt = num(bill.totals?.total);
    months[idx].expenses += amt;
    months[idx].bills += amt;
    totalBills += amt;
  }

  let totalExpenseClaims = 0;
  for (const e of expenses) {
    if (!expenseCounts(e)) continue;
    const d = expenseDate(e);
    if (!d) continue;
    const idx = bucketIndex(d);
    if (idx < 0) continue;
    const amt = num(e.amount);
    months[idx].expenses += amt;
    months[idx].claims += amt;
    totalExpenseClaims += amt;
  }

  for (const m of months) {
    m.revenue = round2(m.revenue);
    m.expenses = round2(m.expenses);
    m.bills = round2(m.bills);
    m.claims = round2(m.claims);
    m.net = round2(m.revenue - m.expenses);
  }

  const totalExpenses = round2(totalBills + totalExpenseClaims);
  return {
    fyLabel: fyLabelFor(startYear),
    fyStartYear: startYear,
    months,
    totalRevenue: round2(totalRevenue),
    totalBills: round2(totalBills),
    totalExpenseClaims: round2(totalExpenseClaims),
    totalExpenses,
    netProfit: round2(totalRevenue - totalExpenses),
  };
}

/**
 * P&L for an Indian financial year. `fyStart` is the FY's starting
 * calendar year (e.g. `2026` ⇒ FY 2026-27); defaults to the running FY.
 * `opts.compare` folds the PRIOR FY (same dataset, one fetch) into
 * `data.previous` for the report page's Δ% column.
 */
export async function getSabcrmPnl(
  fyStart?: number,
  opts?: { compare?: boolean },
  projectId?: string,
): Promise<ActionResult<SabcrmPnl>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const startYear =
    fyStart && Number.isFinite(fyStart) ? fyStart : fyStartYear(new Date());

  try {
    const [invoices, bills, expenses] = await Promise.all([
      fetchInvoices(g.ctx.projectId),
      fetchBills(g.ctx.projectId),
      fetchExpenses(g.ctx.projectId),
    ]);

    const current = computePnlForFy(startYear, invoices, bills, expenses);
    const data: SabcrmPnl = opts?.compare
      ? {
          ...current,
          previous: computePnlForFy(startYear - 1, invoices, bills, expenses),
        }
      : current;
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to compute the profit & loss statement.');
  }
}

// ---------------------------------------------------------------------------
// Balance sheet (as of now)
// ---------------------------------------------------------------------------

/**
 * Simplified balance sheet over the project's finance documents.
 * Retained earnings is presented as the derived balancing figure
 * (assets − liabilities), which by construction equals the same docs'
 * lifetime net position. `asOf` (`YYYY-MM-DD`) excludes documents dated
 * after the cut-off (AR/AP open balances remain current-state fields —
 * an approximation the page's methodology note documents).
 */
export async function getSabcrmBalanceSheet(
  asOf?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmBalanceSheet>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const asOfDay = asOfDayKey(asOf);

  try {
    const [allInvoices, allBills, allReceipts, allPayouts, allExpenses] =
      await Promise.all([
        fetchInvoices(g.ctx.projectId),
        fetchBills(g.ctx.projectId),
        fetchReceipts(g.ctx.projectId),
        fetchPayouts(g.ctx.projectId),
        fetchExpenses(g.ctx.projectId),
      ]);
    const invoices = asOfDay
      ? allInvoices.filter((d) => onOrBefore(d.date, asOfDay))
      : allInvoices;
    const bills = asOfDay
      ? allBills.filter((d) => onOrBefore(d.billDate, asOfDay))
      : allBills;
    const receipts = asOfDay
      ? allReceipts.filter((d) => onOrBefore(d.date, asOfDay))
      : allReceipts;
    const payouts = asOfDay
      ? allPayouts.filter((d) => onOrBefore(d.date, asOfDay))
      : allPayouts;
    const expenses = asOfDay
      ? allExpenses.filter((d) =>
          onOrBefore(d.expense_date ?? d.createdAt, asOfDay),
        )
      : allExpenses;

    const totalReceipts = receipts
      .filter(receiptCounts)
      .reduce((s, r) => s + num(r.amount), 0);
    const totalPayouts = payouts.reduce((s, p) => s + num(p.amount), 0);
    const totalExpenses = expenses
      .filter(expenseCounts)
      .reduce((s, e) => s + num(e.amount), 0);
    const cash = round2(totalReceipts - totalPayouts - totalExpenses);

    const receivable = round2(
      invoices.filter(invoiceCounts).reduce((s, inv) => {
        const total = num(inv.totals?.total);
        const balance =
          inv.balance !== undefined
            ? num(inv.balance)
            : total - num(inv.amountPaid);
        return s + Math.max(0, balance);
      }, 0),
    );

    const payable = round2(
      bills.filter(billCounts).reduce((s, bill) => {
        const total = num(bill.totals?.total);
        const balance =
          bill.balance !== undefined
            ? num(bill.balance)
            : total - num(bill.amountPaid);
        return s + Math.max(0, balance);
      }, 0),
    );

    const totalAssets = round2(cash + receivable);
    const totalLiabilities = payable;
    const retained = round2(totalAssets - totalLiabilities);

    return {
      ok: true,
      data: {
        asOf: asOfDay
          ? `${asOfDay}T23:59:59.999Z`
          : new Date().toISOString(),
        assets: [
          {
            label: 'Cash & bank',
            amount: cash,
            note: 'Payment receipts − payouts − approved expenses',
          },
          {
            label: 'Accounts receivable',
            amount: receivable,
            note: 'Unpaid balance across open invoices',
          },
        ],
        totalAssets,
        liabilities: [
          {
            label: 'Accounts payable',
            amount: payable,
            note: 'Unpaid balance across open vendor bills',
          },
        ],
        totalLiabilities,
        equity: [
          {
            label: 'Retained earnings (derived)',
            amount: retained,
            note: 'Balancing figure: total assets − total liabilities',
          },
        ],
        totalEquity: retained,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute the balance sheet.');
  }
}

// ---------------------------------------------------------------------------
// Cash flow (calendar year)
// ---------------------------------------------------------------------------

/** One calendar year's cash flow over already-fetched documents. */
function computeCashFlowForYear(
  y: number,
  receipts: SabcrmPaymentReceiptDoc[],
  payouts: SabcrmPayoutDoc[],
  expenses: SabcrmExpenseClaimDoc[],
): Omit<SabcrmCashFlow, 'previous'> {
  const months: SabcrmCashFlowMonth[] = MONTHS.map((m) => ({
    month: `${m} ${y}`,
    inflow: 0,
    outflow: 0,
    net: 0,
    closing: 0,
  }));
  let openingCash = 0;

  const apply = (d: Date | null, amount: number, inflow: boolean): void => {
    if (!d || amount === 0) return;
    if (d.getUTCFullYear() < y) {
      openingCash += inflow ? amount : -amount;
      return;
    }
    if (d.getUTCFullYear() !== y) return;
    const bucket = months[d.getUTCMonth()];
    if (inflow) bucket.inflow += amount;
    else bucket.outflow += amount;
  };

  for (const r of receipts) {
    if (!receiptCounts(r)) continue;
    apply(parseDate(r.date), num(r.amount), true);
  }
  for (const p of payouts) {
    apply(parseDate(p.date), num(p.amount), false);
  }
  for (const e of expenses) {
    if (!expenseCounts(e)) continue;
    apply(expenseDate(e), num(e.amount), false);
  }

  openingCash = round2(openingCash);
  let running = openingCash;
  let totalInflow = 0;
  let totalOutflow = 0;
  for (const m of months) {
    m.inflow = round2(m.inflow);
    m.outflow = round2(m.outflow);
    m.net = round2(m.inflow - m.outflow);
    running = round2(running + m.net);
    m.closing = running;
    totalInflow += m.inflow;
    totalOutflow += m.outflow;
  }

  return {
    year: y,
    openingCash,
    months,
    totalInflow: round2(totalInflow),
    totalOutflow: round2(totalOutflow),
    closingCash: running,
  };
}

/**
 * Monthly cash flow for a calendar year; defaults to the current year.
 * `opts.compare` folds the PRIOR year (same dataset, one fetch) into
 * `data.previous` for the report page's Δ% column.
 */
export async function getSabcrmCashFlow(
  year?: number,
  opts?: { compare?: boolean },
  projectId?: string,
): Promise<ActionResult<SabcrmCashFlow>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const y =
    year && Number.isFinite(year) ? year : new Date().getUTCFullYear();

  try {
    const [receipts, payouts, expenses] = await Promise.all([
      fetchReceipts(g.ctx.projectId),
      fetchPayouts(g.ctx.projectId),
      fetchExpenses(g.ctx.projectId),
    ]);

    const current = computeCashFlowForYear(y, receipts, payouts, expenses);
    const data: SabcrmCashFlow = opts?.compare
      ? {
          ...current,
          previous: computeCashFlowForYear(y - 1, receipts, payouts, expenses),
        }
      : current;
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to compute the cash-flow statement.');
  }
}

// ---------------------------------------------------------------------------
// GST summary (GSTR-1 + GSTR-3B style, one period)
// ---------------------------------------------------------------------------

/**
 * GST summary for a `{month: 1-12, year}` period — outward supplies
 * (GSTR-1) grouped by the invoice's GST treatment, plus a GSTR-3B-style
 * outward-tax vs ITC (bill line taxes) net-payable readout. GSTR-2B is
 * a portal-import flow and intentionally out of scope here.
 */
export async function getSabcrmGstSummary(
  period: { month: number; year: number },
  projectId?: string,
): Promise<ActionResult<SabcrmGstSummary>> {
  const month = Number(period?.month);
  const year = Number(period?.year);
  if (
    !Number.isFinite(month) || month < 1 || month > 12 ||
    !Number.isFinite(year) || year < 2017
  ) {
    return {
      ok: false,
      error: 'Invalid period — provide {month: 1-12, year ≥ 2017}.',
    };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const inPeriod = (d: Date | null): boolean =>
    !!d && d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;

  try {
    const [invoices, bills] = await Promise.all([
      fetchInvoices(g.ctx.projectId),
      fetchBills(g.ctx.projectId),
    ]);

    const byTreatment = new Map<string, SabcrmGstr1Row>();
    let outwardTaxable = 0;
    let outwardIgst = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardCess = 0;
    let invoiceCount = 0;

    for (const inv of invoices) {
      if (!invoiceCounts(inv)) continue;
      if (!inPeriod(parseDate(inv.date))) continue;
      invoiceCount += 1;
      const treatment = String(inv.gstTreatment ?? 'consumer');
      const taxable = num(inv.totals?.subTotal);
      const tax = lineTax(inv.items);
      const row =
        byTreatment.get(treatment) ??
        ({
          treatment,
          invoiceCount: 0,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
        } satisfies SabcrmGstr1Row);
      row.invoiceCount += 1;
      row.taxableValue += taxable;
      row.igst += tax.igst;
      row.cgst += tax.cgst;
      row.sgst += tax.sgst;
      row.cess += tax.cess;
      byTreatment.set(treatment, row);

      outwardTaxable += taxable;
      outwardIgst += tax.igst;
      outwardCgst += tax.cgst;
      outwardSgst += tax.sgst;
      outwardCess += tax.cess;
    }

    let itcIgst = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcCess = 0;
    let billCount = 0;
    for (const bill of bills) {
      if (!billCounts(bill)) continue;
      if (!inPeriod(parseDate(bill.billDate))) continue;
      billCount += 1;
      const tax = lineTax(bill.items);
      itcIgst += tax.igst;
      itcCgst += tax.cgst;
      itcSgst += tax.sgst;
      itcCess += tax.cess;
    }

    const gstr1Rows = Array.from(byTreatment.values())
      .map((r) => ({
        ...r,
        taxableValue: round2(r.taxableValue),
        igst: round2(r.igst),
        cgst: round2(r.cgst),
        sgst: round2(r.sgst),
        cess: round2(r.cess),
      }))
      .sort((a, b) => b.taxableValue - a.taxableValue);

    const outwardTotalTax = round2(
      outwardIgst + outwardCgst + outwardSgst + outwardCess,
    );
    const itcTotal = round2(itcIgst + itcCgst + itcSgst + itcCess);

    return {
      ok: true,
      data: {
        period: `${String(month).padStart(2, '0')}-${year}`,
        gstr1Rows,
        outwardTaxable: round2(outwardTaxable),
        outwardIgst: round2(outwardIgst),
        outwardCgst: round2(outwardCgst),
        outwardSgst: round2(outwardSgst),
        outwardCess: round2(outwardCess),
        outwardTotalTax,
        itcIgst: round2(itcIgst),
        itcCgst: round2(itcCgst),
        itcSgst: round2(itcSgst),
        itcCess: round2(itcCess),
        itcTotal,
        netPayable: round2(Math.max(0, outwardTotalTax - itcTotal)),
        invoiceCount,
        billCount,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute the GST summary.');
  }
}

// ---------------------------------------------------------------------------
// E-way bill readiness
// ---------------------------------------------------------------------------

/** ₹50,000 — the standard e-way consignment threshold. */
const EWAY_THRESHOLD = 50_000;

/**
 * E-way bill readiness over the project's invoices: which already
 * carry an e-way bill number, and which exceed the ₹50,000 consignment
 * threshold without one.
 */
export async function getSabcrmEwayReadiness(
  projectId?: string,
): Promise<ActionResult<SabcrmEwayReadiness>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const invoices = await fetchInvoices(g.ctx.projectId);

    const toRow = (inv: SabcrmInvoiceDoc): SabcrmEwayRow => ({
      invoiceId: inv._id,
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      total: round2(num(inv.totals?.total)),
      currency: inv.currency || 'INR',
      status: inv.status ? String(inv.status) : undefined,
      ewayBillNo: inv.ewayBillNo || undefined,
    });

    const withEway: SabcrmEwayRow[] = [];
    const pending: SabcrmEwayRow[] = [];
    for (const inv of invoices) {
      if (!invoiceCounts(inv)) continue;
      if (inv.ewayBillNo) {
        withEway.push(toRow(inv));
      } else if (num(inv.totals?.total) >= EWAY_THRESHOLD) {
        pending.push(toRow(inv));
      }
    }
    const byDateDesc = (a: SabcrmEwayRow, b: SabcrmEwayRow): number =>
      (b.date || '').localeCompare(a.date || '');
    withEway.sort(byDateDesc);
    pending.sort(byDateDesc);

    return {
      ok: true,
      data: { withEway, pending, threshold: EWAY_THRESHOLD },
    };
  } catch (e) {
    return fail(e, 'Failed to compute e-way bill readiness.');
  }
}
