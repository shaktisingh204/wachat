import 'server-only';

/**
 * SabCRM People — Shift Rotations client. Wraps the project-scoped
 * mount `/v1/sabcrm/people/shift-rotations` (crate
 * `crm-shift-rotations::project_router`, collection
 * `crm_shift_rotations`).
 *
 * Every request carries the active SabCRM `projectId` (query for
 * GET/PATCH/DELETE, body for POST) — the engine rejects requests
 * without it (`ScopeMode::Project`). Membership is validated by the
 * gated actions in `sabcrm-people-shift-rotations.actions.ts` BEFORE
 * calling this client.
 *
 * Wire shapes are camelCase, so the legacy types from
 * `./crm-shift-rotations` are re-used. `pattern[].shiftId` is sent as a
 * plain 24-hex string (the engine's `ObjectId` visitor accepts hex
 * strings on JSON input); responses arrive as extended JSON and are
 * deflated here. The list endpoint returns
 * `{ items, page, limit, hasMore }`.
 */
import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type {
  CrmShiftRotationCreateInput,
  CrmShiftRotationDoc,
  CrmShiftRotationListParams,
  CrmShiftRotationUpdateInput,
} from './crm-shift-rotations';

export type {
  CrmShiftRotationCreateInput,
  CrmShiftRotationDay,
  CrmShiftRotationDoc,
  CrmShiftRotationListParams,
  CrmShiftRotationStatus,
  CrmShiftRotationUpdateInput,
} from './crm-shift-rotations';

const BASE = '/v1/sabcrm/people/shift-rotations';

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

export interface SabcrmShiftRotationListResponse {
  items: CrmShiftRotationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export const sabcrmPeopleShiftRotationsApi = {
  /** `GET /v1/sabcrm/people/shift-rotations` — paginated envelope list. */
  list: async (
    projectId: string,
    params?: CrmShiftRotationListParams,
  ): Promise<SabcrmShiftRotationListResponse> => {
    const res = await rustFetch<SabcrmShiftRotationListResponse>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status === 'all' ? undefined : params?.status,
        employeeId: params?.employeeId,
        departmentId: params?.departmentId,
        teamId: params?.teamId,
        isActive: params?.isActive,
      })}`,
    );
    return { ...res, items: deflateDocs(res.items ?? []) };
  },

  /** `GET /v1/sabcrm/people/shift-rotations/{id}` — single (404 ⇒ throws). */
  getById: async (
    projectId: string,
    id: string,
  ): Promise<CrmShiftRotationDoc> =>
    deflateDoc(
      await rustFetch<CrmShiftRotationDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    ),

  /** `POST /v1/sabcrm/people/shift-rotations` — create under project scope. */
  create: async (
    projectId: string,
    input: CrmShiftRotationCreateInput,
  ): Promise<{ id: string; entity: CrmShiftRotationDoc }> => {
    const res = await rustFetch<{ id: string; entity: CrmShiftRotationDoc }>(
      BASE,
      {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      },
    );
    return { id: res.id, entity: deflateDoc(res.entity) };
  },

  /** `PATCH /v1/sabcrm/people/shift-rotations/{id}` — partial update. */
  update: async (
    projectId: string,
    id: string,
    patch: CrmShiftRotationUpdateInput,
  ): Promise<CrmShiftRotationDoc> =>
    deflateDoc(
      await rustFetch<CrmShiftRotationDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),

  /** `DELETE /v1/sabcrm/people/shift-rotations/{id}` — hard delete. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
