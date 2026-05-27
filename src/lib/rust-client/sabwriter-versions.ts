import 'server-only';

/**
 * SabWriter versions client — wraps `/v1/sabwriter/versions`.
 *
 * Version history is append-only. Restore is implemented at the action
 * layer as `getVersion + updateDocument(contentJson)`.
 */
import { rustFetch } from './fetcher';
import type { SabwriterContentJson } from './sabwriter-documents';

export interface SabwriterDocumentVersionDoc {
  _id: string;
  userId?: string;
  documentId: string;
  version: number;
  contentJson: SabwriterContentJson;
  authorUserId: string;
  comment?: string;
  savedAt: string;
}

export interface VersionListParams {
  documentId: string;
  page?: number;
  limit?: number;
}

export interface VersionListResponse {
  items: SabwriterDocumentVersionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateVersionInput {
  documentId: string;
  contentJson: SabwriterContentJson;
  comment?: string;
}

function qs(p: VersionListParams): string {
  const u = new URLSearchParams();
  u.set('documentId', p.documentId);
  if (p.page != null) u.set('page', String(p.page));
  if (p.limit != null) u.set('limit', String(p.limit));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const sabwriterVersionsApi = {
  list: (p: VersionListParams) =>
    rustFetch<VersionListResponse>(`/v1/sabwriter/versions${qs(p)}`),
  getById: (id: string) =>
    rustFetch<SabwriterDocumentVersionDoc>(
      `/v1/sabwriter/versions/${encodeURIComponent(id)}`,
    ),
  create: (input: CreateVersionInput) =>
    rustFetch<{ id: string; entity: SabwriterDocumentVersionDoc }>(
      '/v1/sabwriter/versions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
