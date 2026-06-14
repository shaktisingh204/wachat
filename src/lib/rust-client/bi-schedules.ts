import 'server-only';

/**
 * BI Schedules client — wraps `/v1/sabbi/schedules`. Cron-driven workbook
 * report delivery to email recipients in pdf | csv | inline format.
 */
import { rustFetch } from './fetcher';

export type BiScheduleFormat = 'pdf' | 'csv' | 'inline';
export type BiScheduleStatus = 'active' | 'paused' | 'archived';

export interface BiScheduleDoc {
  _id: string;
  userId?: string;
  name: string;
  workbookId: string;
  cron: string;
  recipients: string[];
  format: BiScheduleFormat;
  lastRunAt?: string;
  nextRunAt?: string;
  status: BiScheduleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiScheduleListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: BiScheduleStatus | 'active_visible' | 'all';
  workbookId?: string;
}

export interface BiScheduleListResponse {
  items: BiScheduleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BiScheduleCreateInput {
  name: string;
  workbookId: string;
  cron: string;
  recipients?: string[];
  format: BiScheduleFormat;
}

export interface BiScheduleUpdateInput {
  name?: string;
  cron?: string;
  recipients?: string[];
  format?: BiScheduleFormat;
  status?: BiScheduleStatus;
}

const BASE = '/v1/sabbi/schedules';

function buildQuery(params?: BiScheduleListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set('q', params.q.trim());
  if (typeof params.page === 'number') sp.set('page', String(params.page));
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.workbookId) sp.set('workbookId', params.workbookId);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listBiSchedules(
  params?: BiScheduleListParams,
): Promise<BiScheduleListResponse> {
  return rustFetch<BiScheduleListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getBiSchedule(id: string): Promise<BiScheduleDoc> {
  return rustFetch<BiScheduleDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createBiSchedule(
  input: BiScheduleCreateInput,
): Promise<{ id: string; entity: BiScheduleDoc }> {
  return rustFetch(`${BASE}`, { method: 'POST', body: JSON.stringify(input) });
}

export async function updateBiSchedule(
  id: string,
  patch: BiScheduleUpdateInput,
): Promise<BiScheduleDoc> {
  return rustFetch<BiScheduleDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteBiSchedule(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
