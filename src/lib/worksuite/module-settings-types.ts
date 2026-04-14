/**
 * Worksuite Module Settings — tenant-specific singletons and small
 * configuration tables ported from the PHP/Laravel Worksuite source:
 *
 *   InvoiceSetting, TaskSetting, ProjectSetting, ProjectStatusSetting,
 *   AttendanceSetting, ExpensesCategoryRole, CurrencyFormatSetting.
 *
 * Singletons (one row per tenant) are keyed on `userId`. Multi-row
 * tables (project statuses, category-role matrix, currency formats)
 * still use `userId` for tenant scoping but allow many documents.
 *
 * `WsDateLike` is mirrored here so this module doesn't need to reach
 * back into the company types file for a trivial alias.
 */

export type WsDateLike = string | Date;

/* ───────────────── Invoice Settings (singleton) ───────────────── */

export type WsInvoiceTaxCalculation = 'before-discount' | 'after-discount';

export interface WsInvoiceSetting {
  _id?: string;
  userId?: string;
  invoice_prefix?: string;
  /** Minimum number of digits in the sequence portion (e.g. 6 → 000001). */
  invoice_digit?: number;
  invoice_number_separator?: string;
  due_after_days?: number;
  tax_calculation?: WsInvoiceTaxCalculation;
  show_tax_column?: boolean;
  show_notes?: boolean;
  show_terms?: boolean;
  default_note?: string;
  default_terms?: string;
  hsn_sac_label?: string;
  enable_einvoice?: boolean;
  enable_qr_code?: boolean;
  send_reminder_before_due?: boolean;
  reminder_days_before?: number;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Task Settings (singleton) ───────────────── */

export type WsTaskPriority = 'low' | 'medium' | 'high';

export interface WsTaskSetting {
  _id?: string;
  userId?: string;
  enable_subtasks?: boolean;
  enable_dependencies?: boolean;
  enable_recurring_tasks?: boolean;
  enable_time_logs?: boolean;
  enable_task_ratings?: boolean;
  default_priority?: WsTaskPriority;
  auto_assign_creator?: boolean;
  require_due_date?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Project Settings (singleton) ───────────────── */

export interface WsProjectSetting {
  _id?: string;
  userId?: string;
  enable_milestones?: boolean;
  enable_time_tracking?: boolean;
  enable_kanban?: boolean;
  enable_gantt?: boolean;
  enable_client_portal?: boolean;
  default_status?: string;
  default_priority?: string;
  require_client?: boolean;
  require_deadline?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Project Status Settings (multi-row) ───────────────── */

export interface WsProjectStatusSetting {
  _id?: string;
  userId?: string;
  status_name: string;
  slug: string;
  color?: string;
  /** Lower number = higher priority in ordering. */
  priority?: number;
  /** Marks terminal states such as "completed" or "cancelled". */
  is_final?: boolean;
  is_default?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Attendance Settings (singleton) ───────────────── */

export interface WsAttendanceSetting {
  _id?: string;
  userId?: string;
  /** HH:mm formatted value — stored as string for round-trips through forms. */
  office_start_time?: string;
  office_end_time?: string;
  office_hours?: number;
  /** Minutes. */
  late_mark_after?: number;
  /** Minutes employees may clock in before office_start_time. */
  early_clock_in_allowed?: number;
  /** Hours below which the day is treated as a half day. */
  half_day_after?: number;
  allow_web_checkin?: boolean;
  allow_mobile_checkin?: boolean;
  require_location?: boolean;
  /** Restrict check-ins to these IPs (empty = any). */
  allowed_ip_addresses?: string[];
  work_from_home_allowed?: boolean;
  require_approval?: boolean;
  auto_clock_out?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Expense Category ↔ Role permissions ───────────────── */

export interface WsExpenseCategoryRole {
  _id?: string;
  userId?: string;
  expense_category_id: string;
  role_id: string;
  can_approve?: boolean;
  can_create?: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Currency Format Settings (per-currency) ───────────────── */

export type WsCurrencyFormatPosition =
  | 'front'
  | 'back'
  | 'front-space'
  | 'back-space';

export interface WsCurrencyFormatSetting {
  _id?: string;
  userId?: string;
  currency_id: string;
  position?: WsCurrencyFormatPosition;
  decimal_separator?: string;
  thousand_separator?: string;
  /** Kept for parity with legacy schema — identical semantics to `no_of_decimal`. */
  decimal_digits?: number;
  no_of_decimal?: number;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}
