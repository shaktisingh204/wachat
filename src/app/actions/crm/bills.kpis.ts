import type { CrmBillDoc } from '@/lib/rust-client/crm-bills';

export interface BillKpiSummary {
  /** Sum of `balance` for bills not yet fully paid / cancelled. */
  outstanding: number;
  /** Number of bills past their due date and still unpaid. */
  overdueCount: number;
  /** Total outstanding balance across overdue bills. */
  overdueAmount: number;
  /** Number of bills marked `paid` in the current calendar month. */
  paidThisMonthCount: number;
  /** Sum of `totals.total` for bills paid this month. */
  paidThisMonthAmount: number;
  /** Number of draft bills. */
  draftCount: number;
  /** Average days between bill date and full-pay across paid bills. */
  avgDaysToPay: number | null;
}

/**
 * Compute the §1D KPI strip from a snapshot of bill rows. The Rust
 * BFF doesn't have a server-side aggregate today, so the page handler
 * loads a representative window of bills and passes them here. Pure
 * function — lives outside `'use server'` so it can stay synchronous.
 */
export function computeBillKpis(
  rows: Pick<
    CrmBillDoc,
    | 'status'
    | 'balance'
    | 'totals'
    | 'dueDate'
    | 'billDate'
    | 'amountPaid'
    | 'updatedAt'
  >[],
): BillKpiSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let outstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidThisMonthCount = 0;
  let paidThisMonthAmount = 0;
  let draftCount = 0;
  let daysToPayTotal = 0;
  let daysToPayCount = 0;

  for (const r of rows) {
    const status = (r.status ?? '').toLowerCase();
    const balance =
      typeof r.balance === 'number' ? r.balance : r.totals?.total ?? 0;
    const total = typeof r.totals?.total === 'number' ? r.totals.total : 0;

    if (status === 'draft') draftCount += 1;
    if (status !== 'paid' && status !== 'cancelled') {
      outstanding += balance;
      const due = r.dueDate ? new Date(r.dueDate).getTime() : NaN;
      if (!Number.isNaN(due) && due < now.getTime()) {
        overdueCount += 1;
        overdueAmount += balance;
      }
    }
    if (status === 'paid') {
      const paidAt = r.updatedAt ? new Date(r.updatedAt).getTime() : NaN;
      if (!Number.isNaN(paidAt) && paidAt >= monthStart.getTime()) {
        paidThisMonthCount += 1;
        paidThisMonthAmount += total;
      }
      const created = r.billDate ? new Date(r.billDate).getTime() : NaN;
      if (!Number.isNaN(created) && !Number.isNaN(paidAt) && paidAt >= created) {
        daysToPayTotal += (paidAt - created) / 86_400_000;
        daysToPayCount += 1;
      }
    }
  }

  return {
    outstanding,
    overdueCount,
    overdueAmount,
    paidThisMonthCount,
    paidThisMonthAmount,
    draftCount,
    avgDaysToPay: daysToPayCount > 0 ? daysToPayTotal / daysToPayCount : null,
  };
}
