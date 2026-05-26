import 'server-only';

/**
 * SabBugs — Comments rust-client. Wraps `/v1/sabbugs/comments`.
 */
import { rustFetch } from './fetcher';

export interface BugCommentDoc {
  _id: string;
  userId?: string;
  bugId: string;
  authorId: string;
  body: string;
  attachmentIds?: string[];
  status: 'active' | 'deleted';
  createdAt?: string;
  updatedAt?: string;
}

export interface BugCommentListParams {
  bugId: string;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface BugCommentListResponse {
  items: BugCommentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BugCommentCreateInput {
  bugId: string;
  body: string;
  attachmentIds?: string[];
}

export interface BugCommentUpdateInput {
  body?: string;
  attachmentIds?: string[];
}

function buildListQuery(p: BugCommentListParams): string {
  const qs = new URLSearchParams();
  qs.set('bugId', p.bugId);
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.includeDeleted) qs.set('includeDeleted', 'true');
  return `?${qs.toString()}`;
}

export const sabbugsCommentsApi = {
  list: (params: BugCommentListParams) =>
    rustFetch<BugCommentListResponse>(
      `/v1/sabbugs/comments${buildListQuery(params)}`,
    ),
  create: (input: BugCommentCreateInput) =>
    rustFetch<{ id: string; entity: BugCommentDoc }>(
      `/v1/sabbugs/comments`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: BugCommentUpdateInput) =>
    rustFetch<BugCommentDoc>(
      `/v1/sabbugs/comments/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbugs/comments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
