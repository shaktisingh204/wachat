import 'server-only';

/**
 * SabCRM People — Attendance client. Wraps the project-scoped
 * `/v1/sabcrm/people/attendance` mount (P7 People suite, spec
 * `docs/sabcrm/rnd/people-suite.md` WI-16/WI-25), including the
 * `/punch-in` + `/punch-out` shorthand routes.
 *
 * Every method takes the SabCRM `projectId` first and appends it as
 * `?projectId=` (GET/PATCH/DELETE) or injects it into the body (POST,
 * incl. the punch routes) — the engine mount is `ScopeMode::Project`
 * and rejects requests without it.
 *
 * Wire types are re-exported from the legacy `crm-attendance.ts`
 * client — they mirror `hrm_payroll_types::Attendance` and the
 * `crm-attendance` crate DTOs exactly.
 */

import { rustFetch } from './fetcher';
import type {
  CrmAttendanceCreateInput,
  CrmAttendanceDoc,
  CrmAttendancePunchInput,
  CrmAttendanceUpdateInput,
} from './crm-attendance';

export type {
  CrmAttendanceCreateInput,
  CrmAttendanceDoc,
  CrmAttendancePunchInput,
  CrmAttendanceSource,
  CrmAttendanceStatus,
  CrmAttendanceUpdateInput,
  CrmBreakSlot,
  CrmPunchPoint,
} from './crm-attendance';

export interface SabcrmAttendanceListParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  /** ISO-8601 datetime — inclusive lower bound on `date`. */
  dateFrom?: string;
  /** ISO-8601 datetime — inclusive upper bound on `date`. */
  dateTo?: string;
  /** Snake_case wire value (`present` / `half_day` / …). */
  status?: string;
}

function qs(
  projectId: string,
  extra?: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  sp.set('projectId', projectId);
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  return `?${sp.toString()}`;
}

const BASE = '/v1/sabcrm/people/attendance';

export const sabcrmPeopleAttendanceApi = {
  list: (projectId: string, p?: SabcrmAttendanceListParams) =>
    rustFetch<CrmAttendanceDoc[]>(
      `${BASE}${qs(projectId, {
        page: p?.page,
        limit: p?.limit,
        employeeId: p?.employeeId,
        dateFrom: p?.dateFrom,
        dateTo: p?.dateTo,
        status: p?.status,
      })}`,
    ),
  getById: (projectId: string, id: string) =>
    rustFetch<CrmAttendanceDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
    ),
  create: (projectId: string, input: CrmAttendanceCreateInput) =>
    rustFetch<CrmAttendanceDoc>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (projectId: string, id: string, patch: CrmAttendanceUpdateInput) =>
    rustFetch<CrmAttendanceDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (projectId: string, id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      { method: 'DELETE' },
    ),
  punchIn: (projectId: string, input: CrmAttendancePunchInput) =>
    rustFetch<CrmAttendanceDoc>(`${BASE}/punch-in`, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  punchOut: (projectId: string, input: CrmAttendancePunchInput) =>
    rustFetch<CrmAttendanceDoc>(`${BASE}/punch-out`, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
};
