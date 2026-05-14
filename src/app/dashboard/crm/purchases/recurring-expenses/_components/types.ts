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
}
