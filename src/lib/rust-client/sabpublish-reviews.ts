import 'server-only';

/**
 * SabPublish reviews client — wraps `/v1/sabpublish/reviews`.
 * Counterpart of the Rust crate `sabpublish-reviews`.
 */
import { rustFetch } from './fetcher';

export interface SabpublishReviewDoc {
  _id: string;
  userId?: string;
  locationId: string;
  providerId: string;
  externalReviewId: string;
  reviewerName?: string;
  rating: number;
  body?: string;
  postedAt: string;
  replyBody?: string;
  repliedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabpublishReviewListParams {
  locationId?: string;
  providerId?: string;
  filter?: 'all' | 'unreplied';
  limit?: number;
}

export interface SabpublishReviewIngestInput {
  locationId: string;
  providerId: string;
  externalReviewId: string;
  rating: number;
  reviewerName?: string;
  body?: string;
  postedAtMs: number;
}

function buildQuery(p?: SabpublishReviewListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.locationId) qs.set('locationId', p.locationId);
  if (p.providerId) qs.set('providerId', p.providerId);
  if (p.filter) qs.set('filter', p.filter);
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabpublishReviewsApi = {
  list: (params?: SabpublishReviewListParams) =>
    rustFetch<{ items: SabpublishReviewDoc[] }>(
      `/v1/sabpublish/reviews${buildQuery(params)}`,
    ),
  ingest: (input: SabpublishReviewIngestInput) =>
    rustFetch<{ id: string; entity: SabpublishReviewDoc }>(
      '/v1/sabpublish/reviews/ingest',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  reply: (id: string, replyBody: string) =>
    rustFetch<SabpublishReviewDoc>(
      `/v1/sabpublish/reviews/${encodeURIComponent(id)}/reply`,
      { method: 'POST', body: JSON.stringify({ replyBody }) },
    ),
};
