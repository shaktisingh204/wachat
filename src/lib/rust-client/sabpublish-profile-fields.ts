import 'server-only';

/**
 * SabPublish profile-fields client — wraps `/v1/sabpublish/profile-fields`.
 * Counterpart of the Rust crate `sabpublish-profile-fields`.
 */
import { rustFetch } from './fetcher';

export interface SabpublishProfileFieldDoc {
  _id: string;
  userId?: string;
  locationId: string;
  fieldKey: string;
  value: string;
  lastEditedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabpublishProfileFieldUpsertInput {
  locationId: string;
  fieldKey: string;
  value: string;
}

export interface SabpublishProfileFieldBulkInput {
  locationId: string;
  fields: { fieldKey: string; value: string }[];
}

export const sabpublishProfileFieldsApi = {
  list: (locationId: string) =>
    rustFetch<{ items: SabpublishProfileFieldDoc[] }>(
      `/v1/sabpublish/profile-fields?locationId=${encodeURIComponent(locationId)}`,
    ),
  upsert: (input: SabpublishProfileFieldUpsertInput) =>
    rustFetch<{ id: string; entity: SabpublishProfileFieldDoc }>(
      '/v1/sabpublish/profile-fields',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  bulkUpsert: (input: SabpublishProfileFieldBulkInput) =>
    rustFetch<{ upserted: number }>(
      '/v1/sabpublish/profile-fields/bulk',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
