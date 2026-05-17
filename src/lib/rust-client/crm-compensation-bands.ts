import 'server-only';

/**
 * CRM Compensation Bands client — wraps `/v1/crm/compensation-bands`.
 *
 * Field names are snake_case to match the Rust crate's BSON shape
 * (`#[serde(rename_all = "snake_case")]` on create/update DTOs). Wire
 * contract wins over TS convention.
 */
import { rustFetch } from './fetcher';

export type CrmCompensationBandStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'archived';

export interface CrmCompensationBandDoc {
  _id: string;
  userId?: string;
  name: string;
  code?: string;
  level?: string;
  min_salary?: number;
  max_salary?: number;
  mid_salary?: number;
  currency?: string;
  department_id?: string;
  role_title?: string;
  perks: string[];
  is_active: boolean;
  status: CrmCompensationBandStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCompensationBandListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmCompensationBandStatus | 'all';
  level?: string | 'all';
}

export interface CrmCompensationBandListResponse {
  items: CrmCompensationBandDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmCompensationBandCreateInput {
  name: string;
  code?: string;
  level?: string;
  min_salary?: number;
  max_salary?: number;
  mid_salary?: number;
  currency?: string;
  department_id?: string;
  role_title?: string;
  perks?: string[];
  is_active?: boolean;
  status?: CrmCompensationBandStatus;
  notes?: string;
}

export type CrmCompensationBandUpdateInput =
  Partial<CrmCompensationBandCreateInput>;

function buildListQuery(p?: CrmCompensationBandListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.level) qs.set('level', p.level);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCompensationBandsApi = {
  list: (params?: CrmCompensationBandListParams) =>
    rustFetch<CrmCompensationBandListResponse>(
      `/v1/crm/compensation-bands${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmCompensationBandDoc>(
      `/v1/crm/compensation-bands/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmCompensationBandCreateInput) =>
    rustFetch<{ id: string; entity: CrmCompensationBandDoc }>(
      '/v1/crm/compensation-bands',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmCompensationBandUpdateInput) =>
    rustFetch<CrmCompensationBandDoc>(
      `/v1/crm/compensation-bands/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/compensation-bands/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
