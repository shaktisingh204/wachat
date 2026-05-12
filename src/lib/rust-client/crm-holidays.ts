import 'server-only';

/**
 * CRM Holiday client — wraps `/v1/hrm/holidays`.
 *
 * Counterpart of the Rust crate `crm-holidays`. The Rust handlers
 * return the full `Holiday` document on every endpoint; this module
 * narrows the shape into a TS-friendly `CrmHolidayDoc` and provides
 * camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror hrm_payroll_types::Holiday ───────────── */

export type CrmHolidayType =
  | 'national'
  | 'regional'
  | 'religious'
  | 'optional'
  | 'restricted';

export interface CrmHolidayDoc {
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
  name: string;
  holidayType?: CrmHolidayType;
  recurring?: boolean;
  applicableLocations?: string[];
  notes?: string;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmHolidayListParams {
  page?: number;
  limit?: number;
  /** Filter by calendar year (UTC) — e.g. `2026`. */
  year?: number;
  /** Filter by classification. */
  holidayType?: CrmHolidayType;
}

export interface CrmHolidayCreateInput {
  date: string;
  name: string;
  holidayType?: CrmHolidayType;
  recurring?: boolean;
  applicableLocations?: string[];
  notes?: string;
  projectId?: string;
}

export type CrmHolidayUpdateInput = Partial<
  Omit<CrmHolidayCreateInput, 'projectId'>
>;

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmHolidayListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.year != null) qs.set('year', String(p.year));
  if (p.holidayType) qs.set('holidayType', p.holidayType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmHolidaysApi = {
  list: (params?: CrmHolidayListParams) =>
    rustFetch<CrmHolidayDoc[]>(`/v1/hrm/holidays${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmHolidayDoc>(`/v1/hrm/holidays/${encodeURIComponent(id)}`),
  create: (input: CrmHolidayCreateInput) =>
    rustFetch<CrmHolidayDoc>('/v1/hrm/holidays', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmHolidayUpdateInput) =>
    rustFetch<CrmHolidayDoc>(`/v1/hrm/holidays/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/hrm/holidays/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
