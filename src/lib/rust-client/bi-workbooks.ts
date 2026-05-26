import 'server-only';

/**
 * BI Workbooks client — wraps `/v1/bi/workbooks`. A workbook is a named
 * collection of datasets + chart configs (the workbook's curated list).
 */
import { rustFetch } from './fetcher';

export type BiWorkbookStatus = 'active' | 'archived';

export type BiChartConfigSnapshot = Record<string, unknown>;

export interface BiWorkbookDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  datasetIds: string[];
  chartsJson: BiChartConfigSnapshot[];
  status: BiWorkbookStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiWorkbookListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BiWorkbookStatus | 'active_visible' | 'all';
}

export interface BiWorkbookListResponse {
  items: BiWorkbookDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiWorkbookCreateInput {
  name: string;
  description?: string;
  datasetIds?: string[];
  chartsJson?: BiChartConfigSnapshot[];
}

export interface BiWorkbookUpdateInput {
  name?: string;
  description?: string;
  datasetIds?: string[];
  chartsJson?: BiChartConfigSnapshot[];
  status?: BiWorkbookStatus;
}

const BASE = '/v1/bi/workbooks';

function buildQuery(params?: BiWorkbookListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiWorkbooks(
  params?: BiWorkbookListParams,
): Promise<BiWorkbookListResponse> {
  return rustFetch<BiWorkbookListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getBiWorkbook(id: string): Promise<BiWorkbookDoc> {
  return rustFetch<BiWorkbookDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createBiWorkbook(
  input: BiWorkbookCreateInput,
): Promise<{ id: string; entity: BiWorkbookDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateBiWorkbook(
  id: string,
  patch: BiWorkbookUpdateInput,
): Promise<BiWorkbookDoc> {
  return rustFetch<BiWorkbookDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiWorkbook(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
