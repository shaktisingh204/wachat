/**
 * SabCRM Finance — expense-claim-surface action types (spec §3.12).
 *
 * Shared between `sabcrm-finance-expenses.actions.ts` ('use server'
 * modules may only export async functions) and the expense clients.
 *
 * WIRE TRAP: the `crm-expense-claims` crate is snake_case on the wire
 * (`claim_number`, `employee_id`, `expense_date`, …) EXCEPT the tenancy
 * + audit keys (`userId` / `projectId` / `createdAt` / `updatedAt`).
 * These TS types are camelCase — the ACTION file owns the snake_case
 * translation so no client component ever touches wire casing.
 */

import type { CrmExpenseClaimStatus } from '@/lib/rust-client/crm-expense-claims';

/* ─── Status workflow ─────────────────────────────────────────── */

/** Allowed manual transitions per current status (client + action share it). */
export const SABCRM_EXPENSE_TRANSITIONS: Record<
  CrmExpenseClaimStatus,
  CrmExpenseClaimStatus[]
> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected'],
  approved: ['reimbursed'],
  rejected: ['submitted'],
  reimbursed: [],
  cancelled: [],
  archived: [],
};

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full expense-claim form payload (camelCase — the action converts
 * to the crate's snake_case wire). `employeeId` is a REAL picked
 * records-engine person id when the employee exists in the CRM; for
 * non-CRM employees the free-text name doubles as the opaque
 * `employee_id` (the crate types it as a plain string) — this surface
 * never mints placeholder ObjectIds.
 */
export interface SabcrmExpenseFullInput {
  /** Override of the auto-generated `EC-YYYYMM-NNNN` (optional). */
  claimNumber?: string;
  employeeId: string;
  employeeName?: string;
  categoryName?: string;
  amount: number;
  currency?: string;
  /** `YYYY-MM-DD`. */
  expenseDate?: string;
  description?: string;
  /** SabFiles URL (picked via `<SabFileUrlInput>` — never free text). */
  receiptUrl?: string;
  receiptName?: string;
  status?: CrmExpenseClaimStatus;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmExpenseFullPatch = Partial<SabcrmExpenseFullInput>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmExpenseListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmExpenseClaimStatus | '';
  employeeId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the expense date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (employee label already resolved). */
export interface SabcrmExpenseListRow {
  id: string;
  claimNumber: string;
  employeeId: string;
  /** `employee_name` or the batch-resolved person label, else null. */
  employeeLabel: string | null;
  categoryLabel: string;
  /** Expense date (falls back to createdAt). */
  date: string;
  description: string;
  amount: number;
  currency: string;
  /** True when a receipt file is attached. */
  hasReceipt: boolean;
  status: CrmExpenseClaimStatus;
  approverLabel: string;
}

export interface SabcrmExpenseListPage {
  rows: SabcrmExpenseListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmExpenseKpis {
  currency: string;
  /** Σ amount awaiting approval (status `submitted`). */
  pendingApprovalAmount: number;
  pendingApprovalCount: number;
  /** Σ amount reimbursed in the current month (by `updatedAt`). */
  reimbursedThisMonth: number;
  reimbursedThisMonthCount: number;
  /** Claims in `rejected`. */
  rejectedCount: number;
  /** Mean claim size across non-cancelled claims. */
  averageClaim: number;
  count: number;
  sampled: boolean;
}
