import 'server-only';

/**
 * Rewards Catalog client — wraps `/v1/rewards/catalog` on the Rust BFF.
 *
 * `imageFileId` is a SabFiles document id, NEVER a free-text URL — the
 * project-wide SabFiles policy disallows external URL paste for files.
 */
import { rustFetch } from './fetcher';

export interface RewardsCatalogItemDoc {
  _id: string;
  userId?: string;
  programId?: string;
  name: string;
  description?: string;
  imageFileId?: string;
  pointsCost: number;
  stock?: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RewardsCatalogListParams {
  page?: number;
  limit?: number;
  q?: string;
  programId?: string;
  activeOnly?: boolean;
}

export interface RewardsCatalogListResponse {
  items: RewardsCatalogItemDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RewardsCatalogCreateInput {
  name: string;
  description?: string;
  programId?: string;
  imageFileId?: string;
  pointsCost: number;
  stock?: number;
  active?: boolean;
}

export type RewardsCatalogUpdateInput = Partial<RewardsCatalogCreateInput>;

function buildListQuery(p?: RewardsCatalogListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.programId) qs.set('programId', p.programId);
  if (p.activeOnly) qs.set('activeOnly', 'true');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const rewardsCatalogApi = {
  list: (params?: RewardsCatalogListParams) =>
    rustFetch<RewardsCatalogListResponse>(
      `/v1/rewards/catalog${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RewardsCatalogItemDoc>(
      `/v1/rewards/catalog/${encodeURIComponent(id)}`,
    ),
  create: (input: RewardsCatalogCreateInput) =>
    rustFetch<{ id: string; entity: RewardsCatalogItemDoc }>(
      '/v1/rewards/catalog',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: RewardsCatalogUpdateInput) =>
    rustFetch<RewardsCatalogItemDoc>(
      `/v1/rewards/catalog/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/rewards/catalog/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
