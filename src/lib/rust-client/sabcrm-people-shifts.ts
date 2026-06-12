import 'server-only';

/**
 * SabCRM People — Shifts client. Wraps the project-scoped mount
 * `/v1/sabcrm/people/shifts` (crate `crm-shifts::project_router`,
 * collection `crm_shifts`).
 *
 * Every request carries the active SabCRM `projectId` (query for
 * GET/PATCH/DELETE, body for POST) — the engine rejects requests
 * without it (`ScopeMode::Project`). Membership is validated by the
 * gated actions in `sabcrm-people-shifts.actions.ts` BEFORE calling
 * this client.
 *
 * Wire shapes are camelCase (`serde(rename_all = "camelCase")`), so the
 * legacy doc/input types from `./crm-shifts` are re-used verbatim. The
 * list endpoint returns `{ items, page, limit, hasMore }`. ObjectId /
 * DateTime fields arrive as extended JSON and are deflated here.
 */
import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type {
  CrmShiftCreateInput,
  CrmShiftDoc,
  CrmShiftListParams,
  CrmShiftUpdateInput,
} from './crm-shifts';

export type {
  CrmShiftCreateInput,
  CrmShiftDoc,
  CrmShiftListParams,
  CrmShiftStatus,
  CrmShiftUpdateInput,
} from './crm-shifts';

const BASE = '/v1/sabcrm/people/shifts';

function qs(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface SabcrmShiftListResponse {
  items: CrmShiftDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export const sabcrmPeopleShiftsApi = {
  /** `GET /v1/sabcrm/people/shifts` — paginated envelope list. */
  list: async (
    projectId: string,
    params?: CrmShiftListParams,
  ): Promise<SabcrmShiftListResponse> => {
    const res = await rustFetch<SabcrmShiftListResponse>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status === 'all' ? undefined : params?.status,
        isActive: params?.isActive,
        isDefault: params?.isDefault,
        departmentId: params?.departmentId,
      })}`,
    );
    return { ...res, items: deflateDocs(res.items ?? []) };
  },

  /** `GET /v1/sabcrm/people/shifts/{id}` — single shift (404 ⇒ throws). */
  getById: async (projectId: string, id: string): Promise<CrmShiftDoc> =>
    deflateDoc(
      await rustFetch<CrmShiftDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    ),

  /** `POST /v1/sabcrm/people/shifts` — create under the project scope. */
  create: async (
    projectId: string,
    input: CrmShiftCreateInput,
  ): Promise<{ id: string; entity: CrmShiftDoc }> => {
    const res = await rustFetch<{ id: string; entity: CrmShiftDoc }>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    });
    return { id: res.id, entity: deflateDoc(res.entity) };
  },

  /** `PATCH /v1/sabcrm/people/shifts/{id}` — partial update. */
  update: async (
    projectId: string,
    id: string,
    patch: CrmShiftUpdateInput,
  ): Promise<CrmShiftDoc> =>
    deflateDoc(
      await rustFetch<CrmShiftDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),

  /** `DELETE /v1/sabcrm/people/shifts/{id}` — hard delete. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
