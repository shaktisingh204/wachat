import 'server-only';

/**
 * CRM Loyalty Program client — wraps `/v1/crm/loyalty-programs`.
 */
import { rustFetch } from './fetcher';

export type CrmLoyaltyStatus = 'active' | 'paused' | 'archived';

export interface CrmLoyaltyTier {
  name: string;
  threshold: number;
  multiplier: number;
  perks?: string;
}

export interface CrmLoyaltyProgramDoc {
  _id: string;
  userId?: string;
  name: string;
  pointsPerCurrencyUnit: number;
  redemptionRatio: number;
  expiryDays?: number;
  minRedemptionPoints?: number;
  welcomeBonus?: number;
  tiers?: CrmLoyaltyTier[];
  status?: CrmLoyaltyStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmLoyaltyProgramListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmLoyaltyStatus | 'all';
}

export interface CrmLoyaltyProgramListResponse {
  items: CrmLoyaltyProgramDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmLoyaltyProgramCreateInput {
  name: string;
  pointsPerCurrencyUnit: number;
  redemptionRatio: number;
  expiryDays?: number;
  minRedemptionPoints?: number;
  welcomeBonus?: number;
  tiers?: CrmLoyaltyTier[];
  notes?: string;
}

export type CrmLoyaltyProgramUpdateInput = Partial<CrmLoyaltyProgramCreateInput> & {
  status?: CrmLoyaltyStatus;
};

function buildListQuery(p?: CrmLoyaltyProgramListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmLoyaltyProgramsApi = {
  list: (params?: CrmLoyaltyProgramListParams) =>
    rustFetch<CrmLoyaltyProgramListResponse>(
      `/v1/crm/loyalty-programs${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmLoyaltyProgramDoc>(
      `/v1/crm/loyalty-programs/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmLoyaltyProgramCreateInput) =>
    rustFetch<{ id: string; entity: CrmLoyaltyProgramDoc }>(
      '/v1/crm/loyalty-programs',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: CrmLoyaltyProgramUpdateInput) =>
    rustFetch<CrmLoyaltyProgramDoc>(
      `/v1/crm/loyalty-programs/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/loyalty-programs/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
