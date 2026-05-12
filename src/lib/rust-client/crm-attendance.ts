import 'server-only';

/**
 * CRM Attendance client — wraps `/v1/crm/attendance`.
 *
 * Counterpart of the Rust crate `crm-attendance`. The Rust handlers
 * return the full `Attendance` document on every read/write endpoint;
 * this module narrows that shape into a TS-friendly `CrmAttendanceDoc`
 * and provides camelCase access for the UI layer.
 *
 * Beyond CRUD this client exposes `punchIn` / `punchOut` shorthand
 * helpers that match the Rust handlers of the same name — mobile / kiosk
 * flows can stamp today's row in a single round-trip without first
 * fetching it.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror hrm_payroll_types::Attendance ───────── */

/** Day-level attendance verdict. Wire format is snake_case. */
export type CrmAttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'leave'
  | 'holiday'
  | 'wfh';

/** Where the punch came from. Wire format is lowercase. */
export type CrmAttendanceSource = 'manual' | 'biometric' | 'web' | 'mobile';

export interface CrmPunchPoint {
  at: string;
  lat?: number;
  lng?: number;
  ip?: string;
  device?: string;
  selfieFileId?: string;
}

export interface CrmBreakSlot {
  in: string;
  out?: string;
}

export interface CrmAttendanceDoc {
  _id: string;
  identity?: {
    id?: string;
    projectId?: string;
    userId?: string;
    tenantId?: string;
  };
  audit?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
  };
  date: string;
  employeeId: string;
  shiftId?: string;
  punchIn?: CrmPunchPoint;
  punchOut?: CrmPunchPoint;
  breaks?: CrmBreakSlot[];
  totalHours?: number;
  overtimeHours?: number;
  status: CrmAttendanceStatus;
  lateByMinutes?: number;
  earlyOutByMinutes?: number;
  source: CrmAttendanceSource;
  approverId?: string;
  notes?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAttendanceListParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  /** Inclusive lower bound on `date`. ISO-8601 datetime. */
  dateFrom?: string;
  /** Inclusive upper bound on `date`. ISO-8601 datetime. */
  dateTo?: string;
  status?: CrmAttendanceStatus;
}

export interface CrmAttendanceCreateInput {
  date: string;
  employeeId: string;
  status: CrmAttendanceStatus;
  shiftId?: string;
  punchIn?: CrmPunchPoint;
  punchOut?: CrmPunchPoint;
  breaks?: CrmBreakSlot[];
  totalHours?: number;
  overtimeHours?: number;
  lateByMinutes?: number;
  earlyOutByMinutes?: number;
  source?: CrmAttendanceSource;
  approverId?: string;
  notes?: string;
  projectId?: string;
}

export type CrmAttendanceUpdateInput = Partial<
  Omit<CrmAttendanceCreateInput, 'projectId'>
>;

/**
 * Body for `/v1/crm/attendance/punch-in` and `/punch-out`. Only
 * `employeeId` is required — the server fills `at` with `Utc::now()`
 * when absent and resolves "today" on its own clock.
 */
export interface CrmAttendancePunchInput {
  employeeId: string;
  at?: string;
  lat?: number;
  lng?: number;
  ip?: string;
  device?: string;
  selfieFileId?: string;
  source?: CrmAttendanceSource;
}

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmAttendanceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.dateFrom) qs.set('dateFrom', p.dateFrom);
  if (p.dateTo) qs.set('dateTo', p.dateTo);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAttendanceApi = {
  list: (params?: CrmAttendanceListParams) =>
    rustFetch<CrmAttendanceDoc[]>(
      `/v1/crm/attendance${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAttendanceDoc>(
      `/v1/crm/attendance/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAttendanceCreateInput) =>
    rustFetch<CrmAttendanceDoc>('/v1/crm/attendance', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmAttendanceUpdateInput) =>
    rustFetch<CrmAttendanceDoc>(
      `/v1/crm/attendance/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/attendance/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
  /**
   * Stamp today's punch-in for `input.employeeId`. The Rust handler
   * upserts the (employeeId, today) attendance row — call this from the
   * mobile flow once the user taps "Clock in".
   */
  punchIn: (input: CrmAttendancePunchInput) =>
    rustFetch<CrmAttendanceDoc>('/v1/crm/attendance/punch-in', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** Mirror of {@link crmAttendanceApi.punchIn} for clock-out. */
  punchOut: (input: CrmAttendancePunchInput) =>
    rustFetch<CrmAttendanceDoc>('/v1/crm/attendance/punch-out', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
