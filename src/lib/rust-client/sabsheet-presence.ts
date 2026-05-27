import 'server-only';

/** SabSheet Presence client — wraps `/v1/sabsheet/presence`. */
import { rustFetch } from './fetcher';

export interface SabsheetPresenceSelection {
  row: number;
  col: number;
  anchorRow: number;
  anchorCol: number;
}

export interface SabsheetPresenceDoc {
  _id: string;
  sheetId: string;
  workbookId: string;
  userId: string;
  selection: SabsheetPresenceSelection;
  color: string;
  lastSeenAt: string;
}

export interface SabsheetPresenceUpsertInput {
  sheetId: string;
  workbookId: string;
  selection: SabsheetPresenceSelection;
  color: string;
}

export interface SabsheetPresenceListResponse {
  items: SabsheetPresenceDoc[];
}

const BASE = '/v1/sabsheet/presence';

export async function listSabsheetPresence(
  workbookId: string,
  opts?: { sheetId?: string; withinSecs?: number },
): Promise<SabsheetPresenceListResponse> {
  const sp = new URLSearchParams();
  sp.set('workbookId', workbookId);
  if (opts?.sheetId) sp.set('sheetId', opts.sheetId);
  if (typeof opts?.withinSecs === 'number') sp.set('withinSecs', String(opts.withinSecs));
  return rustFetch<SabsheetPresenceListResponse>(`${BASE}?${sp.toString()}`);
}

export async function upsertSabsheetPresenceRust(
  input: SabsheetPresenceUpsertInput,
): Promise<{ ok: boolean }> {
  return rustFetch(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
