import 'server-only';

/** SabSheet Named Ranges client — wraps `/v1/sabsheet/named-ranges`. */
import { rustFetch } from './fetcher';

export interface SabsheetNamedRangeDoc {
  _id: string;
  workbookId: string;
  ownerUserId: string;
  name: string;
  sheetId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabsheetNamedRangeCreateInput {
  workbookId: string;
  name: string;
  sheetId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SabsheetNamedRangeUpdateInput {
  name?: string;
  sheetId?: string;
  startRow?: number;
  startCol?: number;
  endRow?: number;
  endCol?: number;
}

export interface SabsheetNamedRangeListResponse {
  items: SabsheetNamedRangeDoc[];
}

const BASE = '/v1/sabsheet/named-ranges';

export async function listSabsheetNamedRanges(
  workbookId: string,
): Promise<SabsheetNamedRangeListResponse> {
  return rustFetch<SabsheetNamedRangeListResponse>(
    `${BASE}?workbookId=${encodeURIComponent(workbookId)}`,
  );
}

export async function createSabsheetNamedRange(
  input: SabsheetNamedRangeCreateInput,
): Promise<{ id: string; entity: SabsheetNamedRangeDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSabsheetNamedRange(
  id: string,
  patch: SabsheetNamedRangeUpdateInput,
): Promise<SabsheetNamedRangeDoc> {
  return rustFetch<SabsheetNamedRangeDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSabsheetNamedRange(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
