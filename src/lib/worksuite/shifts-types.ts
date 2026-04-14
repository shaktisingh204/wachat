/**
 * Worksuite Employee Shifts, Shift Rotations & Attendance — TypeScript
 * types mirroring the Laravel models in /script (EmployeeShift,
 * EmployeeShiftChangeRequest, EmployeeShiftSchedule, ShiftRotation,
 * ShiftRotationSequence, AutomateShift, RotationAutomateLog,
 * Attendance). All IDs stored as string representations of Mongo
 * ObjectIds on the client; CRUD helpers coerce them to ObjectId on
 * write.
 */

export type WsDayOff = 'week-off' | 'consecutive';

/** Days of the week — used in office_open_days arrays. */
export type WsWeekDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Core employee shift configuration. */
export interface WsEmployeeShift {
  _id?: string;
  userId: string;                // tenant
  name: string;                  // shift name
  color_code: string;            // hex color for calendar/swatch
  clock_in_time?: string;        // HH:mm
  clock_out_time?: string;       // HH:mm
  total_hours?: number;
  late_mark_after: number;       // minutes
  early_clock_in: number;        // minutes allowed before start
  office_open_days: WsWeekDay[]; // days office is open
  office_start_time: string;     // HH:mm
  office_end_time: string;       // HH:mm
  office_hours?: number;
  days_off_type: WsDayOff;
  break_time_hours?: number;
  half_day_after?: number;       // hours after which it's full day
  half_day_start?: string;       // HH:mm
  half_day_end?: string;         // HH:mm
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type WsShiftChangeStatus = 'pending' | 'approved' | 'rejected';

/** Employee-initiated request to swap shifts on a given date. */
export interface WsEmployeeShiftChangeRequest {
  _id?: string;
  userId: string;                // tenant
  user_id: string;               // employee id
  date: string | Date;           // date of the change
  current_shift_id: string;
  requested_shift_id: string;
  status: WsShiftChangeStatus;
  reason?: string;
  approved_by?: string;
  approved_at?: string | Date;
  rejection_reason?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Single row for "this employee is on THIS shift on THIS date". */
export interface WsEmployeeShiftSchedule {
  _id?: string;
  userId: string;                // tenant
  user_id: string;               // employee id
  employee_shift_id: string;
  date: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Named rotation (e.g. "2-2-3 rotation"). */
export interface WsShiftRotation {
  _id?: string;
  userId: string;                // tenant
  name: string;
  description?: string;
  is_active: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Ordered sequence entry inside a rotation. */
export interface WsShiftRotationSequence {
  _id?: string;
  userId: string;                // tenant
  shift_rotation_id: string;
  shift_id: string;              // references WsEmployeeShift
  duration_days: number;         // how many days this shift runs
  sequence_order: number;        // 1-based order
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type WsAutomateShiftStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Auto-assignment of a rotation across a date range for N employees. */
export interface WsAutomateShift {
  _id?: string;
  userId: string;                // tenant
  shift_rotation_id: string;
  user_ids: string[];            // employees to apply rotation to
  start_date: string | Date;
  end_date: string | Date;
  status: WsAutomateShiftStatus;
  last_run_at?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Log row written whenever a rotation expansion runs. */
export interface WsRotationAutomateLog {
  _id?: string;
  userId: string;                // tenant
  automate_shift_id: string;
  run_at: string | Date;
  inserted_count: number;
  message?: string;
  success: boolean;
}

/**
 * Extended attendance row — the richer schema from Worksuite
 * (clock in/out time + IP + geolocation + shift linkage).
 * Kept separate from existing `CrmAttendance` in
 * `src/lib/definitions.ts`.
 */
export interface WsAttendanceExt {
  _id?: string;
  userId: string;                // tenant
  user_id: string;               // employee id
  date: string | Date;
  clock_in_time?: string | Date;
  clock_out_time?: string | Date;
  clock_in_ip?: string;
  clock_out_ip?: string;
  working_from?: string;         // "office" | "home" | etc.
  late: boolean;
  half_day: boolean;
  working_hours?: number;
  location_id?: string;
  shift_id?: string;             // legacy
  employee_shift_id?: string;
  overwrite_attendance: boolean;
  latitude?: string;
  longitude?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
