import 'server-only';

/** SabSheet Versions client — wraps `/v1/sabsheet/versions`. */
import { rustFetch } from './fetcher';

export interface SabsheetVersionDoc {
  _id: string;
  workbookId: string;
  ownerUserId: string;
  version: number;
  savedAt: string;
  savedBy: string;
  comment?: string;
  snapshotFileId?: string;
}

export interface SabsheetVersionCreateInput {
  workbookId: string;
  comment?: string;
  /** SabFiles file id holding the dumped snapshot JSON. */
  snapshotFileId?: string;
}

export interface SabsheetVersionListResponse {
  items: SabsheetVersionDoc[];
}

const BASE = '/v1/sabsheet/versions';

export async function listSabsheetVersions(
  workbookId: string,
  limit?: number,
): Promise<SabsheetVersionListResponse> {
  const sp = new URLSearchParams();
  sp.set('workbookId', workbookId);
  if (limit) sp.set('limit', String(limit));
  return rustFetch<SabsheetVersionListResponse>(`${BASE}?${sp.toString()}`);
}

export async function createSabsheetVersionRust(
  input: SabsheetVersionCreateInput,
): Promise<{ id: string; entity: SabsheetVersionDoc }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function restoreSabsheetVersionRust(
  versionId: string,
): Promise<{ restored: boolean; workbookId: string }> {
  return rustFetch(`${BASE}/restore`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}
