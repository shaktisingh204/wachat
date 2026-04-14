/**
 * Worksuite Leave Management — TypeScript types ported from the
 * Laravel models (Leave, LeaveFile, LeaveType, LeaveSetting).
 *
 * All IDs are stored as string representations of Mongo ObjectIds on
 * the client; server-side CRUD helpers coerce them to ObjectId on
 * write. Every entity carries `userId` for tenant isolation.
 *
 * Collections:
 *   - crm_leave_types
 *   - crm_leaves
 *   - crm_leave_files
 *   - crm_leave_settings
 */

export type WsLeaveStatus = 'pending' | 'approved' | 'rejected';

export type WsLeaveDuration =
  | 'full-day'
  | 'half-day'
  | 'multiple'
  | 'hours';

export type WsHalfDayType = 'first-half' | 'second-half';

export type WsLeaveUnit = 'days' | 'hours' | 'half-days';

export type WsLeaveTypeStatus = 'active' | 'inactive';

/** Leave type master — e.g. "Casual Leave", "Sick Leave". */
export interface WsLeaveType {
  _id?: string;
  userId: string;                 // tenant
  type_name: string;
  no_of_leaves: number;           // per year
  color: string;                  // hex
  monthly_limit: number;
  paid: boolean;
  leave_unit: WsLeaveUnit;
  status: WsLeaveTypeStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** A leave application. */
export interface WsLeave {
  _id?: string;
  userId: string;                 // tenant
  user_id: string;                // employee id (CrmEmployee._id)
  leave_type_id: string;
  duration: WsLeaveDuration;
  half_day_type?: WsHalfDayType;
  leave_date: string | Date;
  /** For duration === 'multiple' — inclusive end date. */
  end_date?: string | Date;
  /** For duration === 'hours'. */
  hours?: number;
  reason: string;
  status: WsLeaveStatus;
  reject_reason?: string;
  approved_by?: string;
  approved_at?: string | Date;
  applied_at?: string | Date;
  /** Resolved working-day count (halves = 0.5, multi-day = span, hours = hours/hours_per_day). */
  days_count: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Attachment attached to a leave application. */
export interface WsLeaveFile {
  _id?: string;
  userId: string;                 // tenant
  leave_id: string;
  filename: string;
  url: string;
  size?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Tenant-level leave settings. Single document per tenant. */
export interface WsLeaveSetting {
  _id?: string;
  userId: string;                 // tenant
  monthly_leaves_allowed: number;
  allowed_leaves_per_week: number;
  require_approval: boolean;
  allow_half_day: boolean;
  allow_hourly: boolean;
  allow_future_leave: boolean;
  max_days_advance: number;
  hours_per_day: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Convenience row for calendar views — a single employee-day entry. */
export interface WsLeaveCalendarEntry {
  _id: string;
  user_id: string;
  leave_type_id: string;
  type_name: string;
  color: string;
  date: string;                   // YYYY-MM-DD
  duration: WsLeaveDuration;
  half_day_type?: WsHalfDayType;
  days_count: number;
  employeeName?: string;
}

/** Per-type balance row used on the balance page. */
export interface WsLeaveBalanceRow {
  leave_type_id: string;
  type_name: string;
  color: string;
  allocated: number;              // from leave type
  used: number;                   // sum of approved days_count
  remaining: number;
  monthly_limit: number;
  paid: boolean;
}

/** Per-employee balance map used on the balance matrix page. */
export interface WsLeaveBalanceEmployee {
  employee_id: string;
  employee_name: string;
  rows: WsLeaveBalanceRow[];
}

/** Aggregated report row for getLeaveReport. */
export interface WsLeaveReportRow {
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  type_name: string;
  color: string;
  approved_days: number;
  pending_days: number;
  rejected_days: number;
}
