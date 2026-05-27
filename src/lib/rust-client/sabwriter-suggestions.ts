import 'server-only';

/**
 * SabWriter suggestions client — wraps `/v1/sabwriter/suggestions`.
 *
 * Suggestions are "track-changes" proposals. `proposalJson` carries
 * TipTap insert/delete steps; the editor applies them on accept.
 */
import { rustFetch } from './fetcher';

export interface SabwriterSuggestionAnchor {
  from: number;
  to: number;
}

export type SabwriterSuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface SabwriterSuggestionDoc {
  _id: string;
  userId?: string;
  documentId: string;
  anchor: SabwriterSuggestionAnchor;
  authorUserId: string;
  /** TipTap insert / delete step JSON. */
  proposalJson: Record<string, unknown>;
  status: SabwriterSuggestionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SuggestionListParams {
  documentId: string;
  status?: SabwriterSuggestionStatus | 'all';
  page?: number;
  limit?: number;
}

export interface SuggestionListResponse {
  items: SabwriterSuggestionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateSuggestionInput {
  documentId: string;
  anchor: SabwriterSuggestionAnchor;
  proposalJson: Record<string, unknown>;
}

function qs(p: SuggestionListParams): string {
  const u = new URLSearchParams();
  u.set('documentId', p.documentId);
  if (p.status) u.set('status', p.status);
  if (p.page != null) u.set('page', String(p.page));
  if (p.limit != null) u.set('limit', String(p.limit));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const sabwriterSuggestionsApi = {
  list: (p: SuggestionListParams) =>
    rustFetch<SuggestionListResponse>(`/v1/sabwriter/suggestions${qs(p)}`),
  getById: (id: string) =>
    rustFetch<SabwriterSuggestionDoc>(
      `/v1/sabwriter/suggestions/${encodeURIComponent(id)}`,
    ),
  create: (input: CreateSuggestionInput) =>
    rustFetch<{ id: string; entity: SabwriterSuggestionDoc }>(
      '/v1/sabwriter/suggestions',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  accept: (id: string) =>
    rustFetch<{ ok: boolean; entity: SabwriterSuggestionDoc }>(
      `/v1/sabwriter/suggestions/${encodeURIComponent(id)}/accept`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  reject: (id: string) =>
    rustFetch<{ ok: boolean; entity: SabwriterSuggestionDoc }>(
      `/v1/sabwriter/suggestions/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
};
