import 'server-only';

/**
 * Rewards Referral client — wraps `/v1/rewards/referrals`. Each referral
 * doc owns a single shareable code; conversions are pushed into the
 * embedded `conversions` array via the conversions endpoint.
 */
import { rustFetch } from './fetcher';

export type RewardsReferralConversionKind =
  | 'signed_up'
  | 'first_purchase'
  | 'qualified';

export interface RewardsReferralConversion {
  inviteeId: string;
  convertedAt: string;
  kind: RewardsReferralConversionKind;
  awardedPoints: number;
}

export interface RewardsReferralDoc {
  _id: string;
  userId?: string;
  memberId: string;
  programId?: string;
  code: string;
  sharedAt: string;
  conversions: RewardsReferralConversion[];
  rewardPoints: number;
  active: boolean;
  updatedAt?: string;
}

export interface RewardsReferralListParams {
  page?: number;
  limit?: number;
  memberId?: string;
  programId?: string;
  activeOnly?: boolean;
}

export interface RewardsReferralListResponse {
  items: RewardsReferralDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RewardsReferralCreateInput {
  memberId: string;
  code: string;
  programId?: string;
}

export interface RewardsReferralConversionInput {
  inviteeId: string;
  kind: RewardsReferralConversionKind;
  awardedPoints?: number;
}

function buildListQuery(p?: RewardsReferralListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.memberId) qs.set('memberId', p.memberId);
  if (p.programId) qs.set('programId', p.programId);
  if (p.activeOnly) qs.set('activeOnly', 'true');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rewardsReferralsApi = {
  list: (params?: RewardsReferralListParams) =>
    rustFetch<RewardsReferralListResponse>(
      `/v1/rewards/referrals${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RewardsReferralDoc>(
      `/v1/rewards/referrals/${encodeURIComponent(id)}`,
    ),
  create: (input: RewardsReferralCreateInput) =>
    rustFetch<{ id: string; entity: RewardsReferralDoc }>(
      '/v1/rewards/referrals',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  logConversion: (id: string, input: RewardsReferralConversionInput) =>
    rustFetch<RewardsReferralDoc>(
      `/v1/rewards/referrals/${encodeURIComponent(id)}/conversions`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/rewards/referrals/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
