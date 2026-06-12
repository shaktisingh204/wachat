import 'server-only';

/**
 * SabCRM People — Holidays client. Wraps the project-scoped
 * `/v1/sabcrm/people/holidays` mount (P7 People suite, spec
 * `docs/sabcrm/rnd/people-suite.md` WI-16/WI-27).
 *
 * Every method takes the SabCRM `projectId` first and appends it as
 * `?projectId=` (GET/PATCH/DELETE) or injects it into the body (POST) —
 * the engine mount is `ScopeMode::Project` and rejects requests
 * without it.
 *
 * Wire types are re-exported from the legacy `crm-holidays.ts` client —
 * they mirror `hrm_payroll_types::Holiday` and the `crm-holidays`
 * crate DTOs exactly.
 */

import { rustFetch } from './fetcher';
import type {
  CrmHolidayCreateInput,
  CrmHolidayDoc,
  CrmHolidayType,
  CrmHolidayUpdateInput,
} from './crm-holidays';

export type {
  CrmHolidayCreateInput,
  CrmHolidayDoc,
  CrmHolidayType,
  CrmHolidayUpdateInput,
} from './crm-holidays';

export interface SabcrmHolidayListParams {
  page?: number;
  limit?: number;
  /** Filter by calendar year (UTC) — e.g. `2026`. */
  year?: number;
  holidayType?: CrmHolidayType;
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

const BASE = '/v1/sabcrm/people/holidays';

export const sabcrmPeopleHolidaysApi = {
  list: (projectId: string, p?: SabcrmHolidayListParams) =>
    rustFetch<CrmHolidayDoc[]>(
      `${BASE}${qs(projectId, {
        page: p?.page,
        limit: p?.limit,
        year: p?.year,
        holidayType: p?.holidayType,
      })}`,
    ),
  getById: (projectId: string, id: string) =>
    rustFetch<CrmHolidayDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
    ),
  create: (projectId: string, input: CrmHolidayCreateInput) =>
    rustFetch<CrmHolidayDoc>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (projectId: string, id: string, patch: CrmHolidayUpdateInput) =>
    rustFetch<CrmHolidayDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (projectId: string, id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      { method: 'DELETE' },
    ),
};
