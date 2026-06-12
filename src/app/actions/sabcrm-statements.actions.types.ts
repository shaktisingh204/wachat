/**
 * SabCRM Finance — statement/report action result types.
 *
 * Lives beside `sabcrm-statements.actions.ts` because `'use server'`
 * modules may only export async functions; shared types go here
 * (mirrors the `sabcrm-finance.actions.types.ts` convention).
 *
 * All statements are computed over the PROJECT-scoped finance documents
 * (invoices / bills / receipts / payouts / expenses / journal entries /
 * chart of accounts) that the tranche 1-3 Rust mounts serve — they are
 * simplified-but-correct derivations, not a full general ledger. Each
 * type documents its derivation so the report pages can surface it.
 */

/* ─── Trial balance ───────────────────────────────────────────── */

/** One ledger-head row: opening + journal movement → closing Dr/Cr. */
export interface SabcrmTrialBalanceRow {
  accountId: string;
  name: string;
  code?: string;
  accountType?: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  /** `opening + debits − credits`; ≥ 0 ⇒ Dr column, < 0 ⇒ Cr column. */
  closing: number;
}

export interface SabcrmTrialBalance {
  rows: SabcrmTrialBalanceRow[];
  /** Σ of positive closings (Dr column). */
  totalDebit: number;
  /** Σ of |negative closings| (Cr column). */
  totalCredit: number;
  /** `|totalDebit − totalCredit| ≤ 0.01`. */
  balanced: boolean;
  /** Posted journal entries folded in (drafts/archived excluded). */
  entryCount: number;
  /**
   * `YYYY-MM-DD` cut-off the movement was filtered to (entries dated
   * after it are excluded); absent ⇒ all posted entries (today).
   */
  asOf?: string;
}

/* ─── Profit & loss ───────────────────────────────────────────── */

export interface SabcrmPnlMonth {
  /** `Apr 2026` etc. */
  month: string;
  revenue: number;
  expenses: number;
  /** Vendor-bill share of `expenses` (drill-down split). */
  bills: number;
  /** Approved/reimbursed expense-claim share of `expenses`. */
  claims: number;
  net: number;
}

export interface SabcrmPnl {
  /** Indian FY label, e.g. `2026-27`. */
  fyLabel: string;
  /** FY starting calendar year (`2026` ⇒ FY 2026-27) — drill-link math. */
  fyStartYear: number;
  months: SabcrmPnlMonth[];
  /** Σ invoice totals (non-draft, non-cancelled) in the FY. */
  totalRevenue: number;
  /** Σ bill totals (non-draft, non-cancelled) in the FY. */
  totalBills: number;
  /** Σ approved/reimbursed expense-claim amounts in the FY. */
  totalExpenseClaims: number;
  totalExpenses: number;
  netProfit: number;
  /** Prior FY over the same dataset; present when compare requested. */
  previous?: Omit<SabcrmPnl, 'previous'>;
}

/* ─── Balance sheet ───────────────────────────────────────────── */

export interface SabcrmBalanceSheetLine {
  label: string;
  amount: number;
  /** How the number was derived (shown as the row's hint). */
  note?: string;
}

export interface SabcrmBalanceSheet {
  asOf: string;
  assets: SabcrmBalanceSheetLine[];
  totalAssets: number;
  liabilities: SabcrmBalanceSheetLine[];
  totalLiabilities: number;
  equity: SabcrmBalanceSheetLine[];
  totalEquity: number;
}

/* ─── Cash flow ───────────────────────────────────────────────── */

export interface SabcrmCashFlowMonth {
  month: string;
  /** Payment receipts booked in the month. */
  inflow: number;
  /** Payouts + expense claims booked in the month. */
  outflow: number;
  net: number;
  /** Running cash position (opening + cumulative net). */
  closing: number;
}

export interface SabcrmCashFlow {
  year: number;
  /** Receipts − payouts − expenses BEFORE 1 Jan of `year`. */
  openingCash: number;
  months: SabcrmCashFlowMonth[];
  totalInflow: number;
  totalOutflow: number;
  closingCash: number;
  /** Prior calendar year over the same dataset; present when compared. */
  previous?: Omit<SabcrmCashFlow, 'previous'>;
}

/* ─── GST (GSTR-1 / GSTR-3B style summaries) ──────────────────── */

export interface SabcrmGstr1Row {
  /** `b2b`, `consumer`, `export`, … (invoice `gstTreatment`). */
  treatment: string;
  invoiceCount: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export interface SabcrmGstSummary {
  /** `MM-YYYY`. */
  period: string;
  /* GSTR-1 — outward supplies grouped by GST treatment. */
  gstr1Rows: SabcrmGstr1Row[];
  outwardTaxable: number;
  outwardIgst: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardCess: number;
  outwardTotalTax: number;
  /* GSTR-3B — table 4 (ITC from bills) + net payable. */
  itcIgst: number;
  itcCgst: number;
  itcSgst: number;
  itcCess: number;
  itcTotal: number;
  /** `max(0, outwardTotalTax − itcTotal)`. */
  netPayable: number;
  invoiceCount: number;
  billCount: number;
}

/* ─── E-way bills ─────────────────────────────────────────────── */

export interface SabcrmEwayRow {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  total: number;
  currency: string;
  status?: string;
  /** Set when the invoice already carries an e-way bill number. */
  ewayBillNo?: string;
}

export interface SabcrmEwayReadiness {
  /** Invoices that already carry an e-way bill number. */
  withEway: SabcrmEwayRow[];
  /** Invoices ≥ threshold without an e-way bill number (action needed). */
  pending: SabcrmEwayRow[];
  /** INR consignment threshold used (₹50,000). */
  threshold: number;
}
