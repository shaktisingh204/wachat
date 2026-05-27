import 'server-only';

/**
 * SabPublish citations client — wraps `/v1/sabpublish/citations`.
 * Counterpart of the Rust crate `sabpublish-citations`.
 */
import { rustFetch } from './fetcher';

export type SabpublishCitationStatus =
  | 'discovered'
  | 'claimed'
  | 'disputed'
  | 'resolved';

export interface SabpublishCitationDoc {
  _id: string;
  userId?: string;
  locationId: string;
  sourceUrl: string;
  foundFields: { name?: string; address?: string; phone?: string };
  matchScore: number;
  status: SabpublishCitationStatus;
  lastCheckedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabpublishCitationListParams {
  locationId: string;
  status?: SabpublishCitationStatus;
  limit?: number;
}

export interface SabpublishCitationIngestInput {
  locationId: string;
  sourceUrl: string;
  foundName?: string;
  foundAddress?: string;
  foundPhone?: string;
  matchScore: number;
}

function buildQuery(p: SabpublishCitationListParams): string {
  const qs = new URLSearchParams();
  qs.set('locationId', p.locationId);
  if (p.status) qs.set('status', p.status);
  if (p.limit != null) qs.set('limit', String(p.limit));
  return `?${qs.toString()}`;
}

export const sabpublishCitationsApi = {
  list: (params: SabpublishCitationListParams) =>
    rustFetch<{ items: SabpublishCitationDoc[] }>(
      `/v1/sabpublish/citations${buildQuery(params)}`,
    ),
  ingest: (input: SabpublishCitationIngestInput) =>
    rustFetch<{ id: string; entity: SabpublishCitationDoc }>(
      '/v1/sabpublish/citations/ingest',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  updateStatus: (id: string, status: SabpublishCitationStatus) =>
    rustFetch<SabpublishCitationDoc>(
      `/v1/sabpublish/citations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    ),
};
