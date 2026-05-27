import 'server-only';

/** SabSheet Comments client — wraps `/v1/sabsheet/comments`. */
import { rustFetch } from './fetcher';

export interface SabsheetCommentDoc {
  _id: string;
  sheetId: string;
  workbookId: string;
  ownerUserId: string;
  row: number;
  col: number;
  authorUserId: string;
  body: string;
  resolved: boolean;
  parentCommentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabsheetCommentCreateInput {
  sheetId: string;
  workbookId: string;
  row: number;
  col: number;
  body: string;
  parentCommentId?: string;
}

export interface SabsheetCommentUpdateInput {
  body?: string;
  resolved?: boolean;
}

export interface SabsheetCommentListResponse {
  items: SabsheetCommentDoc[];
}

const BASE = '/v1/sabsheet/comments';

export async function listSabsheetComments(
  workbookId: string,
  opts?: { sheetId?: string; includeResolved?: boolean },
): Promise<SabsheetCommentListResponse> {
  const sp = new URLSearchParams();
  sp.set('workbookId', workbookId);
  if (opts?.sheetId) sp.set('sheetId', opts.sheetId);
  if (opts?.includeResolved) sp.set('includeResolved', 'true');
  return rustFetch<SabsheetCommentListResponse>(`${BASE}?${sp.toString()}`);
}

export async function createSabsheetCommentRust(
  input: SabsheetCommentCreateInput,
): Promise<{ id: string; entity: SabsheetCommentDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSabsheetCommentRust(
  id: string,
  patch: SabsheetCommentUpdateInput,
): Promise<SabsheetCommentDoc> {
  return rustFetch<SabsheetCommentDoc>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSabsheetCommentRust(id: string): Promise<{ deleted: boolean }> {
  return rustFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
