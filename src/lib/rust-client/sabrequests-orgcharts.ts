import 'server-only';

/**
 * Org Chart client — wraps `/v1/sabrequests/orgcharts`.
 *
 * Counterpart of the Rust crate `sabrequests-orgcharts`. Used by blueprint
 * stages whose `approverKind = "manager_of_requester"` — the
 * `resolveManager` endpoint maps a requester user id to their manager
 * at request-creation time.
 */
import { rustFetch } from './fetcher';

export interface OrgChartDoc {
  _id: string;
  projectId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  name?: string;
  orgId?: string;
  /** Map of userId → managerUserId (both 24-char hex strings). */
  managerOf: Record<string, string>;
}

export interface OrgChartUpsertInput {
  projectId?: string;
  name?: string;
  orgId?: string;
  managerOf: Record<string, string>;
}

export interface OrgChartUpdateInput {
  setManagerOf?: Record<string, string>;
  unsetUsers?: string[];
  name?: string;
}

export const sabrequestsOrgchartsApi = {
  list: (orgId?: string) => {
    const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
    return rustFetch<OrgChartDoc[]>(`/v1/sabrequests/orgcharts${qs}`);
  },
  resolve: (userId: string, orgId?: string) => {
    const qs = new URLSearchParams({ userId });
    if (orgId) qs.set('orgId', orgId);
    return rustFetch<{ userId: string; managerUserId: string }>(
      `/v1/sabrequests/orgcharts/resolve?${qs.toString()}`,
    );
  },
  upsert: (input: OrgChartUpsertInput) =>
    rustFetch<OrgChartDoc>(`/v1/sabrequests/orgcharts`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: OrgChartUpdateInput) =>
    rustFetch<OrgChartDoc>(`/v1/sabrequests/orgcharts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/sabrequests/orgcharts/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
