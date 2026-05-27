import 'server-only';

/**
 * SabCreator Publishing client — wraps `/v1/sabcreator/publications`.
 * Mirrors `rust/crates/sabcreator-publishing/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export interface SabcreatorPublicationDoc {
  _id: string;
  userId: string;
  appId: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  snapshotJson: Record<string, unknown>;
}

export interface SabcreatorPublicationListParams {
  page?: number;
  limit?: number;
  appId?: string;
}

export interface SabcreatorPublicationListResponse {
  items: SabcreatorPublicationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorPublishInput {
  appId: string;
  snapshotJson: Record<string, unknown>;
}

function buildQuery(p?: SabcreatorPublicationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.appId) qs.set('appId', p.appId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorPublishingApi = {
  list: (params?: SabcreatorPublicationListParams) =>
    rustFetch<SabcreatorPublicationListResponse>(
      `/v1/sabcreator/publications${buildQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcreatorPublicationDoc>(
      `/v1/sabcreator/publications/${encodeURIComponent(id)}`,
    ),
  getLatestForApp: (appId: string) =>
    rustFetch<SabcreatorPublicationDoc>(
      `/v1/sabcreator/publications/latest/${encodeURIComponent(appId)}`,
    ),
  publish: (input: SabcreatorPublishInput) =>
    rustFetch<{ id: string; version: number; entity: SabcreatorPublicationDoc }>(
      '/v1/sabcreator/publications',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
};
