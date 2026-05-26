import 'server-only';

/**
 * BI Datasets client — wraps `/v1/bi/datasets`.
 *
 * A dataset points at a tabular source: SabFiles-hosted CSV, system Mongo
 * collection, or a saved REST endpoint. The query exec layer materialises
 * rows at chart-render time.
 */
import { rustFetch } from './fetcher';

export type BiDatasetSource = 'csv_upload' | 'mongo_collection' | 'rest_api';
export type BiDatasetStatus = 'active' | 'archived';

export interface BiDatasetSchemaColumn {
  name: string;
  type?: string;
}

export interface BiDatasetDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  source: BiDatasetSource;
  fileId?: string;
  collectionName?: string;
  restUrl?: string;
  schemaJson?: { columns?: BiDatasetSchemaColumn[]; [key: string]: unknown };
  rowCount?: number;
  lastRefreshAt?: string;
  status: BiDatasetStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiDatasetListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BiDatasetStatus | 'active_visible' | 'all';
  source?: BiDatasetSource;
}

export interface BiDatasetListResponse {
  items: BiDatasetDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiDatasetCreateInput {
  name: string;
  description?: string;
  source: BiDatasetSource;
  fileId?: string;
  collectionName?: string;
  restUrl?: string;
  schemaJson?: Record<string, unknown>;
  rowCount?: number;
}

export interface BiDatasetUpdateInput {
  name?: string;
  description?: string;
  fileId?: string;
  collectionName?: string;
  restUrl?: string;
  schemaJson?: Record<string, unknown>;
  rowCount?: number;
  status?: BiDatasetStatus;
}

export interface BiDatasetPreviewResponse {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
}

const BASE = '/v1/bi/datasets';

function buildQuery(params?: BiDatasetListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.source) sp.set('source', params.source);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiDatasets(
  params?: BiDatasetListParams,
): Promise<BiDatasetListResponse> {
  return rustFetch<BiDatasetListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getBiDataset(id: string): Promise<BiDatasetDoc> {
  return rustFetch<BiDatasetDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createBiDataset(
  input: BiDatasetCreateInput,
): Promise<{ id: string; entity: BiDatasetDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBiDataset(
  id: string,
  patch: BiDatasetUpdateInput,
): Promise<BiDatasetDoc> {
  return rustFetch<BiDatasetDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiDataset(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function refreshBiDataset(id: string): Promise<BiDatasetDoc> {
  return rustFetch<BiDatasetDoc>(`${BASE}/${encodeURIComponent(id)}/refresh`, {
    method: 'POST',
  });
}

export async function previewBiDataset(id: string): Promise<BiDatasetPreviewResponse> {
  return rustFetch<BiDatasetPreviewResponse>(`${BASE}/${encodeURIComponent(id)}/preview`);
}
