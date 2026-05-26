import 'server-only';

/**
 * BI Charts client — wraps `/v1/bi/charts`. Owns chart CRUD + the run
 * endpoint that materialises aggregated rows for a chart.
 */
import { rustFetch } from './fetcher';

export type BiChartType = 'bar' | 'line' | 'pie' | 'table' | 'kpi' | 'map' | 'heatmap';
export type BiChartStatus = 'active' | 'archived';
export type BiChartAgg = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type BiFilterOp =
  | 'eq'
  | 'ne'
  | 'in'
  | 'nin'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains';

export interface BiChartMeasure {
  column: string;
  agg: BiChartAgg;
  alias?: string;
}

export interface BiChartConfig {
  dimensions?: string[];
  measures?: BiChartMeasure[];
  selectColumns?: string[];
  [key: string]: unknown;
}

export interface BiChartFilter {
  column: string;
  op: BiFilterOp;
  value: unknown;
}

export interface BiChartDrilldown {
  targetChartId?: string;
  paramColumn?: string;
}

export interface BiChartDoc {
  _id: string;
  userId?: string;
  workbookId: string;
  datasetId: string;
  name: string;
  type: BiChartType;
  configJson: BiChartConfig;
  filtersJson: BiChartFilter[];
  drilldownJson?: BiChartDrilldown;
  status: BiChartStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiChartListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BiChartStatus | 'active_visible' | 'all';
  workbookId?: string;
  datasetId?: string;
}

export interface BiChartListResponse {
  items: BiChartDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiChartCreateInput {
  name: string;
  workbookId: string;
  datasetId: string;
  type: BiChartType;
  configJson?: BiChartConfig;
  filtersJson?: BiChartFilter[];
  drilldownJson?: BiChartDrilldown;
}

export interface BiChartUpdateInput {
  name?: string;
  datasetId?: string;
  type?: BiChartType;
  configJson?: BiChartConfig;
  filtersJson?: BiChartFilter[];
  drilldownJson?: BiChartDrilldown;
  status?: BiChartStatus;
}

export interface BiChartColumn {
  key: string;
  role: 'dimension' | 'measure';
  kind?: 'string' | 'number' | 'date';
}

export interface BiChartRunInput {
  extraFilters?: BiChartFilter[];
  limit?: number;
}

export interface BiChartRunResponse {
  rows: Record<string, unknown>[];
  columns: BiChartColumn[];
  /** `"renderable"` | `"raw"` | `"unsupported"`. */
  mode: 'renderable' | 'raw' | 'unsupported';
}

const BASE = '/v1/bi/charts';

function buildQuery(params?: BiChartListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.workbookId) sp.set('workbookId', params.workbookId);
  if (params.datasetId) sp.set('datasetId', params.datasetId);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiCharts(params?: BiChartListParams): Promise<BiChartListResponse> {
  return rustFetch<BiChartListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getBiChart(id: string): Promise<BiChartDoc> {
  return rustFetch<BiChartDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createBiChart(
  input: BiChartCreateInput,
): Promise<{ id: string; entity: BiChartDoc }> {
  return rustFetch(`${BASE}`, { method: 'POST', body: JSON.stringify(input) });
}

export async function updateBiChart(
  id: string,
  patch: BiChartUpdateInput,
): Promise<BiChartDoc> {
  return rustFetch<BiChartDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiChart(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function runBiChart(
  id: string,
  input: BiChartRunInput = {},
): Promise<BiChartRunResponse> {
  return rustFetch<BiChartRunResponse>(`${BASE}/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
