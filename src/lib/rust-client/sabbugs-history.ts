import 'server-only';

/**
 * SabBugs — History rust-client. Wraps `/v1/sabbugs/history`.
 *
 * Append-only change log. Writes are typically done server-side by the
 * `sabbugs.actions.ts` server action layer when a bug field changes.
 */
import { rustFetch } from './fetcher';

export interface BugHistoryEntryDoc {
  _id: string;
  userId?: string;
  bugId: string;
  ts: string;
  actorId: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface BugHistoryListParams {
  bugId: string;
  page?: number;
  limit?: number;
  field?: string;
}

export interface BugHistoryListResponse {
  items: BugHistoryEntryDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BugHistoryCreateInput {
  bugId: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

function buildListQuery(p: BugHistoryListParams): string {
  const qs = new URLSearchParams();
  qs.set('bugId', p.bugId);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.field) qs.set('field', p.field);
  return `?${qs.toString()}`;
}

export const sabbugsHistoryApi = {
  list: (params: BugHistoryListParams) =>
    rustFetch<BugHistoryListResponse>(
      `/v1/sabbugs/history${buildListQuery(params)}`,
    ),
  create: (input: BugHistoryCreateInput) =>
    rustFetch<{ id: string; entity: BugHistoryEntryDoc }>(
      `/v1/sabbugs/history`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
