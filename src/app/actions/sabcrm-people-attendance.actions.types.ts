/**
 * SabCRM People — Attendance action types.
 *
 * Shared between `sabcrm-people-attendance.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/people/attendance` surface. Mirrors the
 * `sabcrm-people-employees.actions.types.ts` convention.
 */

import type {
  CrmAttendanceDoc,
  CrmAttendanceSource,
  CrmAttendanceStatus,
  CrmBreakSlot,
  CrmPunchPoint,
} from '@/lib/rust-client/sabcrm-people-attendance';

/* ─── List page ───────────────────────────────────────────────── */

export interface SabcrmAttendanceListFilters {
  page: number;
  limit?: number;
  /** In-page refinement over employee label / notes (engine has no q). */
  q?: string;
  status: CrmAttendanceStatus | '';
  /** Employee FK (the list toolbar's party filter). */
  employeeId?: string;
  /** Inclusive `YYYY-MM-DD` bounds on `date`. */
  from?: string;
  to?: string;
}

/** Display-ready attendance row — labels resolved server-side. */
export interface SabcrmAttendanceListRow {
  id: string;
  date?: string;
  employeeId: string;
  employeeLabel: string | null;
  shiftId?: string;
  shiftLabel: string | null;
  /** `HH:mm` punch times (empty when not punched). */
  punchInAt: string;
  punchOutAt: string;
  totalHours: string;
  overtimeHours: string;
  lateByMinutes: number;
  status: CrmAttendanceStatus;
  source: CrmAttendanceSource;
}

export interface SabcrmAttendanceListPage {
  rows: SabcrmAttendanceListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export interface SabcrmAttendanceKpis {
  presentToday: number;
  absentToday: number;
  lateToday: number;
  markedToday: number;
}

/* ─── Detail (row-expand drawer) ──────────────────────────────── */

export interface SabcrmAttendanceDetail {
  doc: CrmAttendanceDoc;
  employeeLabel: string | null;
  shiftLabel: string | null;
  approverLabel: string | null;
}

/* ─── Form values ─────────────────────────────────────────────── */

/** Punch sub-form (datetime-local string for `at`). */
export interface SabcrmPunchPointValues {
  at: string;
  lat?: string;
  lng?: string;
  ip?: string;
  device?: string;
  selfieFileId?: string;
}

/**
 * What the attendance form submits — full
 * `crm_attendance::dto::CreateAttendanceInput` surface.
 */
export interface SabcrmAttendanceFormValues {
  date: string;
  employeeId: string;
  status: CrmAttendanceStatus;
  shiftId?: string;
  punchIn?: SabcrmPunchPointValues | null;
  punchOut?: SabcrmPunchPointValues | null;
  breaks: { in: string; out?: string }[];
  totalHours?: number;
  overtimeHours?: number;
  lateByMinutes?: number;
  earlyOutByMinutes?: number;
  source?: CrmAttendanceSource | '';
  approverId?: string;
  notes?: string;
}

/** Punch-in/out mini-dialog payload. */
export interface SabcrmPunchValues {
  employeeId: string;
  lat?: number;
  lng?: number;
  device?: string;
  selfieFileId?: string;
  source?: CrmAttendanceSource;
}

/** Re-exported wire slices the client renders in the detail drawer. */
export type {
  CrmAttendanceDoc,
  CrmBreakSlot,
  CrmPunchPoint,
} from '@/lib/rust-client/sabcrm-people-attendance';
