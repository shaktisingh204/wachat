import 'server-only';

/**
 * SabSheet Workbooks client — wraps `/v1/sabsheet/workbooks`. A workbook is
 * the root sharable document (collection of sheets + cells + named ranges +
 * pivots + comments).
 */
import { rustFetch } from './fetcher';

export type SabsheetWorkbookStatus = 'active' | 'archived';

export interface SabsheetWorkbookDoc {
  _id: string;
  ownerUserId: string;
  title: string;
  sharedWithUserIds: string[];
  status: SabsheetWorkbookStatus;
  defaultSheetId?: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabsheetWorkbookListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabsheetWorkbookStatus | 'active_visible' | 'all';
  includeShared?: boolean;
}

export interface SabsheetWorkbookListResponse {
  items: SabsheetWorkbookDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabsheetWorkbookCreateInput {
  title: string;
  sharedWithUserIds?: string[];
}

export interface SabsheetWorkbookUpdateInput {
  title?: string;
  sharedWithUserIds?: string[];
  status?: SabsheetWorkbookStatus;
  defaultSheetId?: string;
}

const BASE = '/v1/sabsheet/workbooks';

function buildQuery(p?: SabsheetWorkbookListParams): string {
  if (!p) return '';
  const sp = new URLSearchParams();
  if (p.q?.trim()) sp.set('q', p.q.trim());
  if (typeof p.page === 'number') sp.set('page', String(p.page));
  if (typeof p.limit === 'number') sp.set('limit', String(p.limit));
  if (p.status) sp.set('status', p.status);
  if (typeof p.includeShared === 'boolean') sp.set('includeShared', String(p.includeShared));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listSabsheetWorkbooks(
  params?: SabsheetWorkbookListParams,
): Promise<SabsheetWorkbookListResponse> {
  return rustFetch<SabsheetWorkbookListResponse>(`${BASE}${buildQuery(params)}`);
}

export async function getSabsheetWorkbook(id: string): Promise<SabsheetWorkbookDoc> {
  return rustFetch<SabsheetWorkbookDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createSabsheetWorkbook(
  input: SabsheetWorkbookCreateInput,
): Promise<{ id: string; entity: SabsheetWorkbookDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSabsheetWorkbook(
  id: string,
  patch: SabsheetWorkbookUpdateInput,
): Promise<SabsheetWorkbookDoc> {
  return rustFetch<SabsheetWorkbookDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSabsheetWorkbook(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
