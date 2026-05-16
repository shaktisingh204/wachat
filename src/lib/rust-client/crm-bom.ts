import 'server-only';

/**
 * CRM BOM client — wraps `/v1/crm/boms`.
 */
import { rustFetch } from './fetcher';

export type CrmBomStatus = 'draft' | 'active' | 'obsolete' | 'archived';

export interface CrmBomComponent {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct?: number;
  optional?: boolean;
  costPerUnit?: number;
}

export interface CrmBomDoc {
  _id: string;
  userId?: string;
  bomNo: string;
  finishedGoodName: string;
  finishedGoodId?: string;
  outputQty: number;
  unit: string;
  effectiveDate?: string;
  version: string;
  notes?: string;
  status?: CrmBomStatus;
  active?: boolean;
  components: CrmBomComponent[];
  labourCost?: number;
  overheadCost?: number;
  totalCost?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmBomListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmBomStatus | 'all';
  finishedGoodId?: string;
}

export interface CrmBomListResponse {
  items: CrmBomDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmBomCreateInput {
  bomNo: string;
  finishedGoodName: string;
  finishedGoodId?: string;
  outputQty: number;
  unit: string;
  effectiveDate?: string;
  version?: string;
  notes?: string;
  components?: CrmBomComponent[];
  labourCost?: number;
  overheadCost?: number;
  totalCost?: number;
}

export type CrmBomUpdateInput = Partial<CrmBomCreateInput> & {
  status?: CrmBomStatus;
  active?: boolean;
};

function buildListQuery(p?: CrmBomListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.finishedGoodId) qs.set('finishedGoodId', p.finishedGoodId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmBomApi = {
  list: (params?: CrmBomListParams) =>
    rustFetch<CrmBomListResponse>(`/v1/crm/boms${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmBomDoc>(`/v1/crm/boms/${encodeURIComponent(id)}`),
  create: (input: CrmBomCreateInput) =>
    rustFetch<{ id: string; entity: CrmBomDoc }>('/v1/crm/boms', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmBomUpdateInput) =>
    rustFetch<CrmBomDoc>(`/v1/crm/boms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/crm/boms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
