import 'server-only';

/**
 * CRM Award Programs client — wraps `/v1/crm/award-programs`.
 */
import { rustFetch } from './fetcher';

export type CrmAwardProgramStatus =
  | 'draft'
  | 'active'
  | 'closed'
  | 'archived';

export interface CrmAwardNomination {
  nominee?: string;
  nomineeId?: string;
  reason?: string;
  nominatedAt?: string;
}

export interface CrmAwardWinner {
  recipient?: string;
  recipientId?: string;
  awardedAt?: string;
  citation?: string;
}

export interface CrmAwardProgramDoc {
  _id: string;
  userId?: string;
  name: string;
  programType: string;
  frequency: string;
  periodStart?: string;
  periodEnd?: string;
  criteria?: string;
  pointsValue?: number;
  cashValue?: number;
  description?: string;
  nominations?: CrmAwardNomination[];
  winners?: CrmAwardWinner[];
  status: CrmAwardProgramStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmAwardProgramListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAwardProgramStatus | 'all';
  programType?: string;
}

export interface CrmAwardProgramListResponse {
  items: CrmAwardProgramDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmAwardProgramCreateInput {
  name: string;
  programType?: string;
  frequency?: string;
  periodStart?: string;
  periodEnd?: string;
  criteria?: string;
  pointsValue?: number;
  cashValue?: number;
  description?: string;
}

export type CrmAwardProgramUpdateInput = Partial<CrmAwardProgramCreateInput> & {
  status?: CrmAwardProgramStatus;
  nominations?: CrmAwardNomination[];
  winners?: CrmAwardWinner[];
};

function buildListQuery(p?: CrmAwardProgramListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.programType) qs.set('programType', p.programType);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmAwardProgramsApi = {
  list: (params?: CrmAwardProgramListParams) =>
    rustFetch<CrmAwardProgramListResponse>(
      `/v1/crm/award-programs${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmAwardProgramDoc>(
      `/v1/crm/award-programs/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmAwardProgramCreateInput) =>
    rustFetch<{ id: string; entity: CrmAwardProgramDoc }>(
      '/v1/crm/award-programs',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmAwardProgramUpdateInput) =>
    rustFetch<CrmAwardProgramDoc>(
      `/v1/crm/award-programs/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/award-programs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
