/**
 * Shared types for the canonical Attendance module client islands.
 *
 * `AttendanceListRow` is the wire-format the server `page.tsx` projects
 * its docs into before handing them off to the client tables /
 * calendars. IDs are stringified so the components stay serialization-
 * safe.
 */

import type {
  CrmAttendanceSource,
  CrmAttendanceStatus,
} from '@/lib/rust-client/crm-attendance';

export interface AttendanceListRow {
  _id: string;
  employeeId: string;
  date: string;
  shiftId?: string;
  punchInAt?: string;
  punchOutAt?: string;
  punchInLat?: number;
  punchInLng?: number;
  totalHours?: number;
  overtimeHours?: number;
  lateByMinutes?: number;
  earlyOutByMinutes?: number;
  status: CrmAttendanceStatus;
  source: CrmAttendanceSource;
  approverId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceKpiSnapshot {
  presentToday: number;
  onLeaveToday: number;
  lateToday: number;
  absentToday: number;
  /** Mean total-hours/day across active rows in the last 7 days. */
  avgHoursThisWeek: number | null;
}

export type AttendancePresetKey =
  | 'today'
  | 'this-week'
  | 'last-30-days'
  | 'late-only'
  | 'leave-only';

export type AttendanceViewMode = 'table' | 'by-employee' | 'by-date';
