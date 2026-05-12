import 'server-only';

/**
 * CRM Deals client — wraps `/v1/crm/deals`.
 *
 * The Rust list response is paginated:
 *   `{ deals: Value[], total, page, limit }`
 * Create returns `{ dealId, message }`; PATCH/DELETE return
 * `{ message }`. Field names are camelCase on the wire.
 */
import { rustFetch } from './fetcher';

export interface CrmDealParty {
  kind: 'client' | 'lead';
  id: string;
}

/** Loose document — Deal flattens multiple core fragments. */
export interface CrmDealDoc {
  _id: string;
  title: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  teamId?: string;
  party?: CrmDealParty;
  amount: number;
  currency?: string;
  probabilityPct?: number;
  expectedClose?: string;
  actualClose?: string;
  status?: string;
  wonLostReason?: string;
  competitors?: string[];
  customFields?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  identity?: { id?: string; projectId?: string; userId?: string };
  audit?: { createdAt?: string; updatedAt?: string };
}

export interface CrmDealListParams {
  page?: number;
  limit?: number;
  q?: string;
  pipelineId?: string;
  stageId?: string;
}

export interface CrmDealListResponse {
  deals: CrmDealDoc[];
  total: number;
  page: number;
  limit: number;
}

export interface CrmDealCreateInput {
  title: string;
  pipelineId: string;
  stageId: string;
  ownerId: string;
  teamId?: string;
  party: CrmDealParty;
  amount: number;
  currency?: string;
  probabilityPct?: number;
  expectedClose: string;
  actualClose?: string;
  status?: string;
  wonLostReason?: string;
  competitors?: string[];
  customFields?: Record<string, unknown>;
  fromKind?: string;
  fromId?: string;
}

export type CrmDealUpdateInput = Partial<Omit<CrmDealCreateInput, 'fromKind' | 'fromId'>>;

function qs(p?: CrmDealListParams): string {
  if (!p) return '';
  const sp = new URLSearchParams();
  if (p.page != null) sp.set('page', String(p.page));
  if (p.limit != null) sp.set('limit', String(p.limit));
  if (p.q) sp.set('q', p.q);
  if (p.pipelineId) sp.set('pipelineId', p.pipelineId);
  if (p.stageId) sp.set('stageId', p.stageId);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const crmDealsApi = {
  list: (p?: CrmDealListParams) =>
    rustFetch<CrmDealListResponse>(`/v1/crm/deals${qs(p)}`),
  getById: (id: string) =>
    rustFetch<{ deal: CrmDealDoc }>(`/v1/crm/deals/${encodeURIComponent(id)}`),
  create: (input: CrmDealCreateInput) =>
    rustFetch<{ dealId: string; message: string }>('/v1/crm/deals', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmDealUpdateInput) =>
    rustFetch<{ message: string }>(`/v1/crm/deals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ message: string }>(`/v1/crm/deals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
