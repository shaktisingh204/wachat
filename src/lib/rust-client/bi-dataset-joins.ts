import 'server-only';

/**
 * BI Dataset Joins client — wraps `/v1/sabbi/dataset-joins`. Saved join
 * definitions between two datasets (inner/left/right/outer).
 */
import { rustFetch } from './fetcher';

export type BiJoinType = 'inner' | 'left' | 'right' | 'outer';
export type BiJoinStatus = 'active' | 'archived';

export interface BiJoinOnColumn {
  left: string;
  right: string;
}

export interface BiDatasetJoinDoc {
  _id: string;
  userId?: string;
  name: string;
  leftId: string;
  rightId: string;
  type: BiJoinType;
  onColumns: BiJoinOnColumn[];
  status: BiJoinStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiJoinListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BiJoinStatus | 'active_visible' | 'all';
  leftId?: string;
  rightId?: string;
}

export interface BiJoinListResponse {
  items: BiDatasetJoinDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiJoinCreateInput {
  name: string;
  leftId: string;
  rightId: string;
  type?: BiJoinType;
  onColumns?: BiJoinOnColumn[];
}

export interface BiJoinUpdateInput {
  name?: string;
  leftId?: string;
  rightId?: string;
  type?: BiJoinType;
  onColumns?: BiJoinOnColumn[];
  status?: BiJoinStatus;
}

const BASE = '/v1/sabbi/dataset-joins';

function buildQuery(params?: BiJoinListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.leftId) sp.set('leftId', params.leftId);
  if (params.rightId) sp.set('rightId', params.rightId);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiJoins(params?: BiJoinListParams): Promise<BiJoinListResponse> {
  return rustFetch<BiJoinListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getBiJoin(id: string): Promise<BiDatasetJoinDoc> {
  return rustFetch<BiDatasetJoinDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createBiJoin(
  input: BiJoinCreateInput,
): Promise<{ id: string; entity: BiDatasetJoinDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBiJoin(
  id: string,
  patch: BiJoinUpdateInput,
): Promise<BiDatasetJoinDoc> {
  return rustFetch<BiDatasetJoinDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiJoin(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
