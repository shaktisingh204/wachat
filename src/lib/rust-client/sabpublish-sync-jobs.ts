import 'server-only';

/**
 * SabPublish sync-jobs client — wraps `/v1/sabpublish/sync-jobs`.
 * Counterpart of the Rust crate `sabpublish-sync-jobs`.
 */
import { rustFetch } from './fetcher';

export type SabpublishSyncKind = 'push' | 'pull' | 'verify';
export type SabpublishSyncStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'partial';

export interface SabpublishSyncJobDoc {
  _id: string;
  userId?: string;
  locationId: string;
  providerId: string;
  kind: SabpublishSyncKind;
  status: SabpublishSyncStatus;
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
  changedFieldsCount: number;
  createdAt?: string;
}

export interface SabpublishSyncJobListParams {
  locationId?: string;
  providerId?: string;
  status?: SabpublishSyncStatus;
  limit?: number;
}

export interface SabpublishSyncJobCreateInput {
  locationId: string;
  providerId: string;
  kind: SabpublishSyncKind;
  status?: SabpublishSyncStatus;
}

export interface SabpublishSyncJobCompleteInput {
  status: SabpublishSyncStatus;
  errorMessage?: string;
  changedFieldsCount?: number;
}

function buildQuery(p?: SabpublishSyncJobListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.locationId) qs.set('locationId', p.locationId);
  if (p.providerId) qs.set('providerId', p.providerId);
  if (p.status) qs.set('status', p.status);
  if (p.limit != null) qs.set('limit', String(p.limit));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabpublishSyncJobsApi = {
  list: (params?: SabpublishSyncJobListParams) =>
    rustFetch<{ items: SabpublishSyncJobDoc[] }>(
      `/v1/sabpublish/sync-jobs${buildQuery(params)}`,
    ),
  create: (input: SabpublishSyncJobCreateInput) =>
    rustFetch<{ id: string; entity: SabpublishSyncJobDoc }>(
      '/v1/sabpublish/sync-jobs',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  complete: (id: string, input: SabpublishSyncJobCompleteInput) =>
    rustFetch<SabpublishSyncJobDoc>(
      `/v1/sabpublish/sync-jobs/${encodeURIComponent(id)}/complete`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
