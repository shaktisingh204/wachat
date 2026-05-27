import 'server-only';

/**
 * SabWriter documents client — wraps `/v1/sabwriter/documents`.
 *
 * A `SabwriterDocument` is the editable draft surface that complements
 * the SabSign envelope flow. The body lives in `contentJson` (TipTap /
 * ProseMirror JSON) — schema is opaque to Rust.
 */
import { rustFetch } from './fetcher';

export type SabwriterDocumentStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'sent_for_signature';

/**
 * The opaque editor body. We deliberately keep this loose so we don't
 * couple the picker / list shells to a specific TipTap schema version.
 */
export type SabwriterContentJson = Record<string, unknown>;

export interface SabwriterDocumentDoc {
  _id: string;
  userId?: string;
  ownerUserId?: string;
  title: string;
  sharedWithUserIds?: string[];
  contentJson: SabwriterContentJson;
  status: SabwriterDocumentStatus;
  version?: number;
  latestVersionId?: string;
  envelopeId?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface DocumentListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabwriterDocumentStatus | 'shared' | 'all';
  includeShared?: boolean;
}

export interface DocumentListResponse {
  items: SabwriterDocumentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateDocumentInput {
  title: string;
  contentJson?: SabwriterContentJson;
  sharedWithUserIds?: string[];
}

export type UpdateDocumentInput = Partial<{
  title: string;
  contentJson: SabwriterContentJson;
  status: SabwriterDocumentStatus;
  sharedWithUserIds: string[];
  envelopeId: string;
}>;

function qs(p?: DocumentListParams): string {
  if (!p) return '';
  const u = new URLSearchParams();
  if (p.page != null) u.set('page', String(p.page));
  if (p.limit != null) u.set('limit', String(p.limit));
  if (p.q) u.set('q', p.q);
  if (p.status) u.set('status', p.status);
  if (p.includeShared != null) u.set('includeShared', String(p.includeShared));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const sabwriterDocumentsApi = {
  list: (p?: DocumentListParams) =>
    rustFetch<DocumentListResponse>(`/v1/sabwriter/documents${qs(p)}`),
  getById: (id: string) =>
    rustFetch<SabwriterDocumentDoc>(
      `/v1/sabwriter/documents/${encodeURIComponent(id)}`,
    ),
  create: (input: CreateDocumentInput) =>
    rustFetch<{ id: string; entity: SabwriterDocumentDoc }>(
      '/v1/sabwriter/documents',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: UpdateDocumentInput) =>
    rustFetch<SabwriterDocumentDoc>(
      `/v1/sabwriter/documents/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabwriter/documents/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  share: (id: string, userIds: string[]) =>
    rustFetch<SabwriterDocumentDoc>(
      `/v1/sabwriter/documents/${encodeURIComponent(id)}/share`,
      { method: 'POST', body: JSON.stringify({ userIds }) },
    ),
};
