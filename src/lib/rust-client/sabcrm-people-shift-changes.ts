import 'server-only';

/**
 * SabCRM People — Shift Change Requests client. Wraps the
 * project-scoped mount `/v1/sabcrm/people/shift-change-requests`
 * (crate `crm-shift-change-requests::project_router`, collection
 * `crm_shift_change_requests`).
 *
 * Every request carries the active SabCRM `projectId` (query for
 * GET/PATCH/DELETE, body for POST — the tenant key stays camelCase
 * even though this entity's own wire is snake_case). Membership is
 * validated by the gated actions in
 * `sabcrm-people-shift-changes.actions.ts` BEFORE calling this client.
 *
 * Wire notes:
 *   - entity fields are intentionally `snake_case` (`employee_id`,
 *     `current_shift_id`, `requested_shift_id`, `effective_date`,
 *     `approver_id`, `approved_at`, `response_notes`) — the Rust struct
 *     has no `rename_all`. The doc/input types from
 *     `./crm-shift-change-requests` mirror that and are re-used.
 *   - the list envelope is ALSO un-renamed: the engine sends
 *     `has_more` (snake_case), unlike the camelCase `hasMore` of the
 *     shifts/rotations crates. This module normalises it.
 *   - ObjectId / DateTime fields arrive as extended JSON and are
 *     deflated here.
 */
import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type {
  CrmShiftChangeRequestCreateInput,
  CrmShiftChangeRequestDoc,
  CrmShiftChangeRequestListParams,
  CrmShiftChangeRequestUpdateInput,
} from './crm-shift-change-requests';

export type {
  CrmShiftChangeRequestCreateInput,
  CrmShiftChangeRequestDoc,
  CrmShiftChangeRequestListParams,
  CrmShiftChangeRequestUpdateInput,
  CrmShiftChangeStatus,
} from './crm-shift-change-requests';

const BASE = '/v1/sabcrm/people/shift-change-requests';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Raw envelope as the engine serializes it (NO rename — `has_more`). */
interface WireListResponse {
  items: CrmShiftChangeRequestDoc[];
  page: number;
  limit: number;
  has_more: boolean;
}

export interface SabcrmShiftChangeListResponse {
  items: CrmShiftChangeRequestDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export const sabcrmPeopleShiftChangesApi = {
  /** `GET /v1/sabcrm/people/shift-change-requests` — paginated list. */
  list: async (
    projectId: string,
    params?: CrmShiftChangeRequestListParams,
  ): Promise<SabcrmShiftChangeListResponse> => {
    const res = await rustFetch<WireListResponse>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status === 'all' ? undefined : params?.status,
        employee_id: params?.employee_id,
      })}`,
    );
    return {
      items: deflateDocs(res.items ?? []),
      page: res.page,
      limit: res.limit,
      hasMore: Boolean(res.has_more),
    };
  },

  /** `GET .../{id}` — single request (404 ⇒ throws). */
  getById: async (
    projectId: string,
    id: string,
  ): Promise<CrmShiftChangeRequestDoc> =>
    deflateDoc(
      await rustFetch<CrmShiftChangeRequestDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    ),

  /** `POST /v1/sabcrm/people/shift-change-requests` — create. */
  create: async (
    projectId: string,
    input: CrmShiftChangeRequestCreateInput,
  ): Promise<{ id: string; entity: CrmShiftChangeRequestDoc }> => {
    const res = await rustFetch<{
      id: string;
      entity: CrmShiftChangeRequestDoc;
    }>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    });
    return { id: res.id, entity: deflateDoc(res.entity) };
  },

  /**
   * `PATCH .../{id}` — partial update. The approve/reject flow is this
   * same PATCH carrying `status` + `approver_id` + `response_notes`;
   * the engine stamps `approved_at` server-side on terminal statuses.
   */
  update: async (
    projectId: string,
    id: string,
    patch: CrmShiftChangeRequestUpdateInput,
  ): Promise<CrmShiftChangeRequestDoc> =>
    deflateDoc(
      await rustFetch<CrmShiftChangeRequestDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),

  /** `DELETE .../{id}` — hard delete. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
