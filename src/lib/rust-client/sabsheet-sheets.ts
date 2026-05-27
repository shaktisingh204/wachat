import 'server-only';

/**
 * SabSheet Sheets client — wraps `/v1/sabsheet/sheets`. Each sheet is a tab
 * inside a workbook.
 */
import { rustFetch } from './fetcher';

export interface SabsheetSheetDoc {
  _id: string;
  workbookId: string;
  ownerUserId: string;
  name: string;
  position: number;
  rowCount: number;
  colCount: number;
  frozenRows: number;
  frozenCols: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabsheetSheetCreateInput {
  workbookId: string;
  name: string;
  position?: number;
  rowCount?: number;
  colCount?: number;
}

export interface SabsheetSheetUpdateInput {
  name?: string;
  position?: number;
  rowCount?: number;
  colCount?: number;
  frozenRows?: number;
  frozenCols?: number;
}

export interface SabsheetSheetListResponse {
  items: SabsheetSheetDoc[];
}

const BASE = '/v1/sabsheet/sheets';

export async function listSabsheetSheets(workbookId: string): Promise<SabsheetSheetListResponse> {
  return rustFetch<SabsheetSheetListResponse>(
    `${BASE}?workbookId=${encodeURIComponent(workbookId)}`,
  );
}

export async function getSabsheetSheet(id: string): Promise<SabsheetSheetDoc> {
  return rustFetch<SabsheetSheetDoc>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createSabsheetSheet(
  input: SabsheetSheetCreateInput,
): Promise<{ id: string; entity: SabsheetSheetDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSabsheetSheet(
  id: string,
  patch: SabsheetSheetUpdateInput,
): Promise<SabsheetSheetDoc> {
  return rustFetch<SabsheetSheetDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSabsheetSheet(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
