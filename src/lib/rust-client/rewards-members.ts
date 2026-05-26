import 'server-only';

/**
 * Rewards Member client — wraps `/v1/rewards/members` on the Rust BFF.
 * One document per `(programId, customerId)` pair. Use `adjust` to mutate
 * balance and trigger tier promotions (computed client-side against the
 * referenced loyalty tier engine).
 */
import { rustFetch } from './fetcher';

export interface RewardsMemberDoc {
  _id: string;
  userId?: string;
  programId: string;
  customerId: string;
  currentPoints: number;
  lifetimePoints: number;
  currentTier?: string;
  joinedAt?: string;
  updatedAt?: string;
}

export interface RewardsMemberListParams {
  page?: number;
  limit?: number;
  programId?: string;
  q?: string;
}

export interface RewardsMemberListResponse {
  items: RewardsMemberDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RewardsMemberCreateInput {
  programId: string;
  customerId: string;
  welcomeBonus?: number;
  initialTier?: string;
}

export interface RewardsMemberAdjustInput {
  delta: number;
  newTier?: string;
}

function buildListQuery(p?: RewardsMemberListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.programId) qs.set('programId', p.programId);
  if (p.q) qs.set('q', p.q);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rewardsMembersApi = {
  list: (params?: RewardsMemberListParams) =>
    rustFetch<RewardsMemberListResponse>(
      `/v1/rewards/members${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RewardsMemberDoc>(
      `/v1/rewards/members/${encodeURIComponent(id)}`,
    ),
  create: (input: RewardsMemberCreateInput) =>
    rustFetch<{ id: string; entity: RewardsMemberDoc }>(
      '/v1/rewards/members',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  adjust: (id: string, input: RewardsMemberAdjustInput) =>
    rustFetch<RewardsMemberDoc>(
      `/v1/rewards/members/${encodeURIComponent(id)}/adjust`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/rewards/members/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
