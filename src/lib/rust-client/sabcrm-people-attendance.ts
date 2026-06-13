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
 *
 * Extended-JSON notes (verified against the crate + bson 2.15 source):
 *
 *   - RESPONSES carry `{$oid}` / `{$date}` wrappers (the gen-1 model
 *     uses `chrono_datetime_as_bson_datetime`); every read below
 *     deflates them back into plain scalars.
 *   - The create/update DTO's top-level `date` uses plain chrono serde
 *     (RFC3339 string), BUT the nested `punchIn` / `punchOut` /
 *     `breaks` reuse the MODEL structs — their datetimes only
 *     deserialize from relaxed extended JSON `{"$date": "<rfc3339>"}`.
 *     The `Sabcrm*Wire` input types below encode that requirement;
 *     `ObjectId` fields (`selfieFileId`) accept plain hex strings.
 *   - The punch routes' `PunchInput.at` is plain chrono — no wrapper.
 */

import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type {
  CrmAttendanceCreateInput,
  CrmAttendanceDoc,
  CrmAttendancePunchInput,
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

/* ─── Wire-input shapes (extended-JSON nested dates) ─────────────── */

/** Relaxed extended-JSON datetime — what the model structs parse. */
export interface SabcrmWireDate {
  $date: string;
}

/** `PunchPoint` as the create/update DTO actually accepts it. */
export interface SabcrmPunchPointWire {
  at: SabcrmWireDate;
  lat?: number;
  lng?: number;
  ip?: string;
  device?: string;
  /** SabFiles `_id` — plain 24-char hex (ObjectId accepts strings). */
  selfieFileId?: string;
}

/** `BreakSlot` as the create/update DTO actually accepts it. */
export interface SabcrmBreakSlotWire {
  in: SabcrmWireDate;
  out?: SabcrmWireDate;
}

/** `CreateAttendanceInput` with the nested model-struct wire shapes. */
export interface SabcrmAttendanceCreateWire
  extends Omit<
    CrmAttendanceCreateInput,
    'punchIn' | 'punchOut' | 'breaks' | 'projectId'
  > {
  punchIn?: SabcrmPunchPointWire;
  punchOut?: SabcrmPunchPointWire;
  breaks?: SabcrmBreakSlotWire[];
}

export type SabcrmAttendanceUpdateWire = Partial<SabcrmAttendanceCreateWire>;

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
  list: async (projectId: string, p?: SabcrmAttendanceListParams) =>
    deflateDocs(
      await rustFetch<CrmAttendanceDoc[]>(
        `${BASE}${qs(projectId, {
          page: p?.page,
          limit: p?.limit,
          employeeId: p?.employeeId,
          dateFrom: p?.dateFrom,
          dateTo: p?.dateTo,
          status: p?.status,
        })}`,
      ),
    ),
  getById: async (projectId: string, id: string) =>
    deflateDoc(
      await rustFetch<CrmAttendanceDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      ),
    ),
  create: async (projectId: string, input: SabcrmAttendanceCreateWire) =>
    deflateDoc(
      await rustFetch<CrmAttendanceDoc>(BASE, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    ),
  update: async (
    projectId: string,
    id: string,
    patch: SabcrmAttendanceUpdateWire,
  ) =>
    deflateDoc(
      await rustFetch<CrmAttendanceDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),
  delete: (projectId: string, id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      { method: 'DELETE' },
    ),
  punchIn: async (projectId: string, input: CrmAttendancePunchInput) =>
    deflateDoc(
      await rustFetch<CrmAttendanceDoc>(`${BASE}/punch-in`, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    ),
  punchOut: async (projectId: string, input: CrmAttendancePunchInput) =>
    deflateDoc(
      await rustFetch<CrmAttendanceDoc>(`${BASE}/punch-out`, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    ),
};
