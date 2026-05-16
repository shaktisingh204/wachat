import 'server-only';

/**
 * CRM Units client — wraps `/v1/crm/units`.
 */
import { rustFetch } from './fetcher';

export type CrmUnitStatus = 'active' | 'archived';

export interface CrmUnitDoc {
  _id: string;
  userId?: string;
  name: string;
  code: string;
  unitType?: string;
  baseUnitId?: string;
  conversionFactor?: number;
  isDefault?: boolean;
  isActive?: boolean;
  status: CrmUnitStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmUnitListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmUnitStatus | 'all';
  unitType?: string;
}

export interface CrmUnitListResponse {
  items: CrmUnitDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmUnitCreateInput {
  name: string;
  code: string;
  unitType?: string;
  baseUnitId?: string;
  conversionFactor?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export type CrmUnitUpdateInput = Partial<CrmUnitCreateInput> & {
  status?: CrmUnitStatus;
};

function buildListQuery(p?: CrmUnitListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.unitType) qs.set('unitType', p.unitType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmUnitsApi = {
  list: (params?: CrmUnitListParams) =>
    rustFetch<CrmUnitListResponse>(`/v1/crm/units${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmUnitDoc>(`/v1/crm/units/${encodeURIComponent(id)}`),
  create: (input: CrmUnitCreateInput) =>
    rustFetch<{ id: string; entity: CrmUnitDoc }>('/v1/crm/units', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmUnitUpdateInput) =>
    rustFetch<CrmUnitDoc>(`/v1/crm/units/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/units/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
