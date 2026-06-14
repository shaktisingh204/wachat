import 'server-only';

/**
 * BI Models client — wraps `/v1/sabbi/models` (the semantic/metrics layer) and
 * the MetricQuery run endpoint `/v1/sabbi/charts/run-query`.
 *
 * A model names a base collection + a reusable vocabulary of measures,
 * dimensions, joins, and segments. Charts, the visual builder, the AI copilot,
 * and embeds all author a `MetricQuery` against a model rather than touching
 * raw collections, so a metric like "revenue" is defined once.
 */
import { rustFetch } from './fetcher';
import type { BiChartRunResponse, BiChartType } from './bi-charts';

export type BiModelStatus = 'active' | 'archived';
export type BiMeasureAgg = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct';
export type BiDimensionKind = 'string' | 'number' | 'date' | 'boolean';
export type BiTimeGrain = 'day' | 'week' | 'month';

export interface BiMeasure {
  key: string;
  label: string;
  agg: BiMeasureAgg;
  column?: string;
  /** currency | percent | number | duration */
  format?: string;
  downIsGood?: boolean;
}

export interface BiDimension {
  key: string;
  label: string;
  column: string;
  kind: BiDimensionKind;
  timeGrain?: BiTimeGrain;
}

export interface BiJoin {
  key: string;
  targetCollection: string;
  localField: string;
  foreignField: string;
  alias: string;
  kind?: 'one' | 'many';
}

export interface BiSegment {
  key: string;
  label: string;
  /** Reusable `{ column, op, value }` filter clauses. */
  filters: Record<string, unknown>[];
}

/** Which JWT id `scopeField` is matched against. */
export type BiScopeBy = 'project' | 'user';

export interface BiModelDoc {
  _id: string;
  userId?: string;
  name: string;
  description?: string;
  collection: string;
  baseFilter?: Record<string, unknown>;
  /** Collection field holding the tenant key (default `userId`). */
  scopeField?: string;
  /** Match `scopeField` against the project (`tid`) or user (`sub`) id. */
  scopeBy?: BiScopeBy;
  /** Whether `scopeField` is stored as a string rather than an ObjectId. */
  scopeString?: boolean;
  measures: BiMeasure[];
  dimensions: BiDimension[];
  joins: BiJoin[];
  segments: BiSegment[];
  /** manual | connector */
  source: string;
  /** crm | pay | chat | mail | sms | flow | sign | sites (when source=connector) */
  connector?: string;
  status: BiModelStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiModelListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BiModelStatus | 'active_visible' | 'all';
  connector?: string;
}

export interface BiModelListResponse {
  items: BiModelDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiModelCreateInput {
  name: string;
  description?: string;
  collection: string;
  baseFilter?: Record<string, unknown>;
  scopeField?: string;
  scopeBy?: BiScopeBy;
  scopeString?: boolean;
  measures?: BiMeasure[];
  dimensions?: BiDimension[];
  joins?: BiJoin[];
  segments?: BiSegment[];
  source?: string;
  connector?: string;
}

export interface BiModelUpdateInput {
  name?: string;
  description?: string;
  collection?: string;
  baseFilter?: Record<string, unknown>;
  scopeField?: string;
  scopeBy?: BiScopeBy;
  scopeString?: boolean;
  measures?: BiMeasure[];
  dimensions?: BiDimension[];
  joins?: BiJoin[];
  segments?: BiSegment[];
  status?: BiModelStatus;
}

/** The semantic AST — selects measures/dimensions/segments by key from a model. */
export interface MetricQueryInput {
  modelId: string;
  measures?: string[];
  dimensions?: string[];
  segments?: string[];
  filters?: { column: string; op: string; value: unknown }[];
  chartType?: BiChartType;
  limit?: number;
}

const BASE = '/v1/sabbi/models';
const CHARTS_BASE = '/v1/sabbi/charts';

function buildQuery(params?: BiModelListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.connector) sp.set('connector', params.connector);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiModels(params?: BiModelListParams): Promise<BiModelListResponse> {
  return rustFetch<BiModelListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getBiModel(id: string): Promise<BiModelDoc> {
  return rustFetch<BiModelDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createBiModel(
  input: BiModelCreateInput,
): Promise<{ id: string; entity: BiModelDoc }> {
  return rustFetch(`${BASE}`, { method: 'POST', body: JSON.stringify(input) });
}

export async function updateBiModel(id: string, patch: BiModelUpdateInput): Promise<BiModelDoc> {
  return rustFetch<BiModelDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiModel(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Run a MetricQuery against a model → aggregated rows + column metadata. */
export async function runBiMetricQuery(query: MetricQueryInput): Promise<BiChartRunResponse> {
  return rustFetch<BiChartRunResponse>(`${CHARTS_BASE}/run-query`, {
    method: 'POST',
    body: JSON.stringify(query),
  });
}

/** A raw, governed aggregation request for the Query Lab. */
export interface RawQueryInput {
  modelId: string;
  /** Aggregation stages appended after the mandatory tenant `$match`. */
  stages: Record<string, unknown>[];
  limit?: number;
}

/**
 * Run a raw aggregation pipeline against a model's collection. The tenant +
 * base-filter `$match` is prepended server-side and write/code-exec stages are
 * rejected — full aggregation power, never escaping the project sandbox.
 */
export async function runBiRawQuery(query: RawQueryInput): Promise<BiChartRunResponse> {
  return rustFetch<BiChartRunResponse>(`${CHARTS_BASE}/run-pipeline`, {
    method: 'POST',
    body: JSON.stringify(query),
  });
}
