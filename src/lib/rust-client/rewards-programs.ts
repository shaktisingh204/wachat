import 'server-only';

/**
 * Rewards Program client — wraps `/v1/rewards/programs` on the Rust BFF.
 *
 * The Rewards module is the Zoho-Thrive-equivalent surface that unifies
 * loyalty + referral + redemption + catalog. `tierEngineRef` reuses the
 * existing `crm_loyalty_programs` tier engine rather than duplicating it.
 */
import { rustFetch } from './fetcher';

export type RewardsProgramStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface RewardsProgramDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  tierEngineRef?: string;
  pointsExpireAfterDays?: number;
  status?: RewardsProgramStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardsProgramListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: RewardsProgramStatus | 'all';
}

export interface RewardsProgramListResponse {
  items: RewardsProgramDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RewardsProgramCreateInput {
  name: string;
  description?: string;
  tierEngineRef?: string;
  pointsExpireAfterDays?: number;
}

export type RewardsProgramUpdateInput = Partial<RewardsProgramCreateInput> & {
  status?: RewardsProgramStatus;
};

function buildListQuery(p?: RewardsProgramListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rewardsProgramsApi = {
  list: (params?: RewardsProgramListParams) =>
    rustFetch<RewardsProgramListResponse>(
      `/v1/rewards/programs${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RewardsProgramDoc>(
      `/v1/rewards/programs/${encodeURIComponent(id)}`,
    ),
  create: (input: RewardsProgramCreateInput) =>
    rustFetch<{ id: string; entity: RewardsProgramDoc }>(
      '/v1/rewards/programs',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: RewardsProgramUpdateInput) =>
    rustFetch<RewardsProgramDoc>(
      `/v1/rewards/programs/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/rewards/programs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
