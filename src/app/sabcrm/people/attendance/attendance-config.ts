/**
 * SabCRM People — attendance surface config (client-safe).
 *
 * The attendance entity's doc-surface vocabulary: status defs + tones,
 * the punch-source vocabulary (mirroring
 * `hrm_payroll_types::attendance::*` snake_case / lowercase wire values
 * exactly), kit-filter mapping and route helpers.
 * Spec: `docs/sabcrm/rnd/people-suite.md` WI-25.
 */

import type {
  CrmAttendanceSource,
  CrmAttendanceStatus,
} from '@/lib/rust-client/crm-attendance';
import type { BadgeTone } from '@/components/sabcrm/20ui';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type { SabcrmAttendanceListFilters } from '@/app/actions/sabcrm-people-attendance.actions.types';

export const ATTENDANCE_STATUSES: (DocStatusDef & {
  value: CrmAttendanceStatus;
})[] = [
  { value: 'present', label: 'Present', tone: 'success' },
  { value: 'absent', label: 'Absent', tone: 'danger' },
  { value: 'half_day', label: 'Half day', tone: 'warning' },
  { value: 'leave', label: 'Leave', tone: 'info' },
  { value: 'holiday', label: 'Holiday', tone: 'neutral' },
  { value: 'wfh', label: 'WFH', tone: 'info' },
];

export function attendanceStatusLabel(
  value: CrmAttendanceStatus | '' | undefined,
): string {
  if (!value) return '';
  return ATTENDANCE_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export const ATTENDANCE_SOURCES: {
  value: CrmAttendanceSource;
  label: string;
  tone: BadgeTone;
}[] = [
  { value: 'manual', label: 'Manual', tone: 'neutral' },
  { value: 'biometric', label: 'Biometric', tone: 'success' },
  { value: 'web', label: 'Web', tone: 'info' },
  { value: 'mobile', label: 'Mobile', tone: 'info' },
];

export function attendanceSourceLabel(
  value: CrmAttendanceSource | '' | undefined,
): string {
  if (!value) return '';
  return ATTENDANCE_SOURCES.find((s) => s.value === value)?.label ?? value;
}

export function attendanceSourceTone(
  value: CrmAttendanceSource | '' | undefined,
): BadgeTone {
  return ATTENDANCE_SOURCES.find((s) => s.value === value)?.tone ?? 'neutral';
}

/**
 * Kit list filters → attendance action filters. The kit's `partyId` is
 * repurposed as the EMPLOYEE filter on this surface (the toolbar's
 * party picker searches employees); the date range maps to the
 * engine's `dateFrom`/`dateTo` bounds on `date`.
 */
export function toAttendanceFilters(
  f: DocListFilters,
): SabcrmAttendanceListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmAttendanceStatus | '') || '',
    employeeId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const PEOPLE_ATTENDANCE_PATH = '/sabcrm/people/attendance';

/** Row navigation — `?open=<id>` deep-links the detail drawer. */
export function attendanceOpenHref(id: string): string {
  return `${PEOPLE_ATTENDANCE_PATH}?open=${encodeURIComponent(id)}`;
}
