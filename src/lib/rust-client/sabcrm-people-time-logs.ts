import 'server-only';

/**
 * SabCRM People — Time Logs client. Wraps the project-scoped
 * `/v1/sabcrm/people/time-logs` mount (crate `crm-time-logs`,
 * `project_router`) per people-suite WI-13/WI-15/WI-16.
 *
 * ## ⚠ WI-13 tenant-key exception
 *
 * On this entity `projectId` already means the WORK project FK (the
 * CRM project the time was logged against), so the SabCRM tenant scope
 * travels as **`tenantProjectId`** instead — query string for
 * GET/PATCH/DELETE, body for POST. Requests without it are rejected
 * 4xx. NEVER send the tenant scope as `projectId` here: it would be
 * interpreted as the work-project filter and silently mis-scope.
 *
 * Wire shapes are re-used from `./crm-time-logs` (same crate, same
 * `crm_time_logs` collection).
 *
 * ⚠ The entity serializes ObjectId/DateTime fields as MongoDB extended
 * JSON (`{$oid}` / `{$date}`) — callers MUST pass fetched documents
 * through `deflateDoc`/`deflateDocs` (`@/lib/sabcrm/finance-extjson`).
 */
import { rustFetch } from './fetcher';
import type {
  CrmTimeLogCreateInput,
  CrmTimeLogDoc,
  CrmTimeLogListParams,
  CrmTimeLogListResponse,
  CrmTimeLogUpdateInput,
} from './crm-time-logs';

export type {
  CrmTimeLogCreateInput,
  CrmTimeLogDoc,
  CrmTimeLogEntityKind,
  CrmTimeLogListParams,
  CrmTimeLogListResponse,
  CrmTimeLogStatus,
  CrmTimeLogUpdateInput,
} from './crm-time-logs';

const BASE = '/v1/sabcrm/people/time-logs';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabcrmPeopleTimeLogsApi = {
  /**
   * `GET /v1/sabcrm/people/time-logs` — paginated list. `projectId` in
   * `params` stays the WORK-project filter; the tenant scope is the
   * separate `tenantProjectId` (first arg).
   */
  list: (
    tenantProjectId: string,
    params?: CrmTimeLogListParams,
  ): Promise<CrmTimeLogListResponse> =>
    rustFetch<CrmTimeLogListResponse>(
      `${BASE}${qs({
        tenantProjectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        projectId: params?.projectId,
        taskId: params?.taskId,
        entityKind: params?.entityKind,
      })}`,
    ),

  /** `GET /{id}` — one time log. */
  getById: (tenantProjectId: string, id: string): Promise<CrmTimeLogDoc> =>
    rustFetch<CrmTimeLogDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ tenantProjectId })}`,
    ),

  /** `POST /` — create under the tenant scope (body `tenantProjectId`). */
  create: (
    tenantProjectId: string,
    input: CrmTimeLogCreateInput,
  ): Promise<{ id: string; entity: CrmTimeLogDoc }> =>
    rustFetch<{ id: string; entity: CrmTimeLogDoc }>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, tenantProjectId }),
    }),

  /** `PATCH /{id}` — partial update (full DTO patchable). */
  update: (
    tenantProjectId: string,
    id: string,
    patch: CrmTimeLogUpdateInput,
  ): Promise<CrmTimeLogDoc> =>
    rustFetch<CrmTimeLogDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ tenantProjectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /{id}`. */
  delete: (
    tenantProjectId: string,
    id: string,
  ): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ tenantProjectId })}`,
      { method: 'DELETE' },
    ),
};
