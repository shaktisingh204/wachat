import 'server-only';

/**
 * Rewards Redemption client — wraps `/v1/rewards/redemptions`. Append-only
 * ledger for member point spend. Only status transitions
 * `pending -> fulfilled` and `pending -> cancelled` are allowed.
 */
import { rustFetch } from './fetcher';

export type RewardsRedemptionStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface RewardsRedemptionDoc {
  _id: string;
  userId?: string;
  memberId: string;
  catalogItemId: string;
  points: number;
  status: RewardsRedemptionStatus;
  redeemedAt: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  notes?: string;
  updatedAt?: string;
}

export interface RewardsRedemptionListParams {
  page?: number;
  limit?: number;
  memberId?: string;
  status?: RewardsRedemptionStatus;
}

export interface RewardsRedemptionListResponse {
  items: RewardsRedemptionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RewardsRedemptionCreateInput {
  memberId: string;
  catalogItemId: string;
  points: number;
  notes?: string;
}

export interface RewardsRedemptionStatusInput {
  status: 'fulfilled' | 'cancelled';
  notes?: string;
}

function buildListQuery(p?: RewardsRedemptionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.memberId) qs.set('memberId', p.memberId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rewardsRedemptionsApi = {
  list: (params?: RewardsRedemptionListParams) =>
    rustFetch<RewardsRedemptionListResponse>(
      `/v1/rewards/redemptions${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RewardsRedemptionDoc>(
      `/v1/rewards/redemptions/${encodeURIComponent(id)}`,
    ),
  create: (input: RewardsRedemptionCreateInput) =>
    rustFetch<{ id: string; entity: RewardsRedemptionDoc }>(
      '/v1/rewards/redemptions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  updateStatus: (id: string, input: RewardsRedemptionStatusInput) =>
    rustFetch<RewardsRedemptionDoc>(
      `/v1/rewards/redemptions/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
};
