/**
 * Shared client-side types for the Recurring Expenses module.
 *
 * Mirrors `WsRecurringExpense` (mongo doc) but with string ids so the
 * list rows are serialization-safe across the server / client boundary.
 */

import type {
  WsFrequency,
  WsRecurringStatus,
} from '@/lib/worksuite/billing-types';

export interface RecurringExpenseRow {
  _id: string;
  name: string;
  amount: number;
  currency: string;
  vendor?: string;
  category_name?: string;
  frequency: WsFrequency;
  frequency_count: number;
  status: WsRecurringStatus;
  start_date?: string;
  next_run_date?: string;
  last_run_date?: string;
  until_date?: string;
  stop_at_count?: number;
  run_count?: number;
  payment_method?: string;
  notes?: string;
  generated_expense_ids?: string[];
}

export interface RecurringExpenseKpiSnapshot {
  active: number;
  paused: number;
  dueNext7: number;
  totalMonthlyValue: number;
  /** Sum of amount for active schedules whose `last_run_date` (or
   *  `next_run_date` if last_run is unset) falls in the current month —
   *  i.e. an estimate of recurring spend booked this month. */
  mtdSpend: number;
  /** Active schedules whose `until_date` (or `stop_at_count` exhaustion)
   *  lands within the next 30 days. */
  expiringCount: number;
  /** Vendor label with the largest sum(amount) across active schedules. */
  topVendor: string | null;
  topVendorAmount: number;
  topVendorCount: number;
}
