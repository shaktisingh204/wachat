import 'server-only';

/** SabSheet Pivot Tables client — wraps `/v1/sabsheet/pivot-tables`. */
import { rustFetch } from './fetcher';

export interface SabsheetPivotConfig {
  rows?: string[];
  columns?: string[];
  values?: Array<{ field: string; agg: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' }>;
  filters?: Array<{ field: string; op: string; value: unknown }>;
  [k: string]: unknown;
}

export interface SabsheetPivotTableDoc {
  _id: string;
  sheetId: string;
  workbookId: string;
  ownerUserId: string;
  name: string;
  sourceRange: string;
  configJson?: SabsheetPivotConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabsheetPivotTableCreateInput {
  sheetId: string;
  workbookId: string;
  name: string;
  sourceRange: string;
  configJson?: SabsheetPivotConfig;
}

export interface SabsheetPivotTableUpdateInput {
  name?: string;
  sourceRange?: string;
  configJson?: SabsheetPivotConfig;
}

export interface SabsheetPivotTableListResponse {
  items: SabsheetPivotTableDoc[];
}

const BASE = '/v1/sabsheet/pivot-tables';

export async function listSabsheetPivotTables(
  workbookId: string,
  sheetId?: string,
): Promise<SabsheetPivotTableListResponse> {
  const sp = new URLSearchParams();
  sp.set('workbookId', workbookId);
  if (sheetId) sp.set('sheetId', sheetId);
  return rustFetch<SabsheetPivotTableListResponse>(`${BASE}?${sp.toString()}`);
}

export async function createSabsheetPivotTable(
  input: SabsheetPivotTableCreateInput,
): Promise<{ id: string; entity: SabsheetPivotTableDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSabsheetPivotTable(
  id: string,
  patch: SabsheetPivotTableUpdateInput,
): Promise<SabsheetPivotTableDoc> {
  return rustFetch<SabsheetPivotTableDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSabsheetPivotTable(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
