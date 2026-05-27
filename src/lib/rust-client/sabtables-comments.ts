import 'server-only';

/**
 * SabTables Comments client — wraps `/v1/sabtables/comments`.
 * Mirrors `rust/crates/sabtables-comments/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export interface SabtablesCommentDoc {
  _id: string;
  userId: string;
  recordId: string;
  tableId: string;
  parentCommentId?: string;
  authorId: string;
  body: string;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface SabtablesCommentListParams {
  recordId: string;
}

export interface SabtablesCommentListResponse {
  items: SabtablesCommentDoc[];
}

export interface SabtablesCommentCreateInput {
  recordId: string;
  tableId: string;
  body: string;
  parentCommentId?: string;
}

export interface SabtablesCommentUpdateInput {
  body: string;
}

export const sabtablesCommentsApi = {
  list: (params: SabtablesCommentListParams) =>
    rustFetch<SabtablesCommentListResponse>(
      `/v1/sabtables/comments?recordId=${encodeURIComponent(params.recordId)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabtablesCommentDoc>(`/v1/sabtables/comments/${encodeURIComponent(id)}`),
  create: (input: SabtablesCommentCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesCommentDoc }>('/v1/sabtables/comments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabtablesCommentUpdateInput) =>
    rustFetch<SabtablesCommentDoc>(`/v1/sabtables/comments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabtables/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
