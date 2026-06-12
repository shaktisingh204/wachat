import 'server-only';

/**
 * SabCRM People — Leave client. Wraps the project-scoped mount
 * `/v1/sabcrm/people/leaves` (crate `crm-leaves::project_router`):
 *
 *   - `/types`        — leave-type catalog (`hrm_payroll_types::LeaveType`,
 *                       collection `crm_leave_types`);
 *   - `/applications` — per-employee requests
 *                       (`hrm_payroll_types::LeaveApplication`,
 *                       collection `crm_leave_applications`), plus the
 *                       `POST /{id}/approve` workflow action.
 *
 * Every request carries the active SabCRM `projectId` (query for
 * GET/PATCH/DELETE, body for POST) — the engine rejects requests
 * without it (`ScopeMode::Project`). Membership is validated by the
 * gated actions in `sabcrm-people-leave.actions.ts` BEFORE calling
 * this client.
 *
 * Wire notes:
 *   - list endpoints return BARE arrays (no envelope) — `hasMore` is
 *     derived by the actions from `rows.length === limit`;
 *   - the engine serializes `ObjectId`/`DateTime` fields as Mongo
 *     extended JSON (`{$oid}` / `{$date}`); this module deflates them
 *     so the declared TS scalars are true;
 *   - application status vocabulary is snake_case
 *     (`pending|approved|rejected|cancelled`).
 */
import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type {
  CrmLeaveAttachment,
  CrmLeaveCreateInput,
  CrmLeaveDoc,
  CrmLeaveStatus,
  CrmLeaveUpdateInput,
} from './crm-leaves';

export type {
  CrmLeaveApproverStep,
  CrmLeaveAttachment,
  CrmLeaveCreateInput,
  CrmLeaveDoc,
  CrmLeaveStatus,
  CrmLeaveUpdateInput,
} from './crm-leaves';

const BASE = '/v1/sabcrm/people/leaves';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/* ─── Leave types (catalog) ───────────────────────────────────── */

/**
 * Full wire shape of a `LeaveType` catalog row. §0 fragments
 * (`Identity` + `Audit`) flatten to the root. NB: `paid: true` and
 * unset optionals are skip-serialized by the engine — hence optional.
 */
export interface SabcrmLeaveTypeDoc {
  _id: string;
  projectId?: string;
  userId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  code: string;
  name: string;
  /** Defaults to `true` when absent (skip-serialized default). */
  paid?: boolean;
  /** Free-text accrual rule, e.g. `"monthly:1.25"`, `"yearly:15"`, `"none"`. */
  accrualRule: string;
  maxBalance?: number;
  carryForward?: boolean;
  encashable?: boolean;
  /** `"male"` / `"female"` — absent ⇒ available to all. */
  genderRestricted?: string;
  minServiceMonths?: number;
}

export interface SabcrmLeaveTypeListParams {
  page?: number;
  limit?: number;
  q?: string;
}

/** `POST /types` body — mirrors `CreateLeaveTypeInput` (camelCase). */
export interface SabcrmLeaveTypeCreateInput {
  code: string;
  name: string;
  paid?: boolean;
  accrualRule?: string;
  maxBalance?: number;
  carryForward?: boolean;
  encashable?: boolean;
  genderRestricted?: string;
  minServiceMonths?: number;
}

export type SabcrmLeaveTypeUpdateInput = Partial<SabcrmLeaveTypeCreateInput>;

/* ─── Applications ────────────────────────────────────────────── */

export interface SabcrmLeaveApplicationListParams {
  page?: number;
  limit?: number;
  /** Applicant (matches the flattened `assignedTo`). */
  employeeId?: string;
  status?: CrmLeaveStatus;
}

export const sabcrmPeopleLeaveApi = {
  /* ---- types catalog ---- */

  listTypes: async (
    projectId: string,
    params?: SabcrmLeaveTypeListParams,
  ): Promise<SabcrmLeaveTypeDoc[]> => {
    const docs = await rustFetch<SabcrmLeaveTypeDoc[]>(
      `${BASE}/types${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
      })}`,
    );
    return deflateDocs(docs);
  },

  getType: async (
    projectId: string,
    id: string,
  ): Promise<SabcrmLeaveTypeDoc> =>
    deflateDoc(
      await rustFetch<SabcrmLeaveTypeDoc>(
        `${BASE}/types/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    ),

  createType: async (
    projectId: string,
    input: SabcrmLeaveTypeCreateInput,
  ): Promise<SabcrmLeaveTypeDoc> =>
    deflateDoc(
      await rustFetch<SabcrmLeaveTypeDoc>(`${BASE}/types`, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    ),

  updateType: async (
    projectId: string,
    id: string,
    patch: SabcrmLeaveTypeUpdateInput,
  ): Promise<SabcrmLeaveTypeDoc> =>
    deflateDoc(
      await rustFetch<SabcrmLeaveTypeDoc>(
        `${BASE}/types/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),

  deleteType: (
    projectId: string,
    id: string,
  ): Promise<{ ok?: boolean; deleted?: boolean }> =>
    rustFetch<{ ok?: boolean; deleted?: boolean }>(
      `${BASE}/types/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),

  /* ---- applications ---- */

  listApplications: async (
    projectId: string,
    params?: SabcrmLeaveApplicationListParams,
  ): Promise<CrmLeaveDoc[]> => {
    const docs = await rustFetch<CrmLeaveDoc[]>(
      `${BASE}/applications${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        employeeId: params?.employeeId,
        status: params?.status,
      })}`,
    );
    return deflateDocs(docs);
  },

  getApplication: async (
    projectId: string,
    id: string,
  ): Promise<CrmLeaveDoc> =>
    deflateDoc(
      await rustFetch<CrmLeaveDoc>(
        `${BASE}/applications/${encodeURIComponent(id)}${qs({ projectId })}`,
      ),
    ),

  createApplication: async (
    projectId: string,
    input: CrmLeaveCreateInput,
  ): Promise<CrmLeaveDoc> =>
    deflateDoc(
      await rustFetch<CrmLeaveDoc>(`${BASE}/applications`, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    ),

  updateApplication: async (
    projectId: string,
    id: string,
    patch: CrmLeaveUpdateInput,
  ): Promise<CrmLeaveDoc> =>
    deflateDoc(
      await rustFetch<CrmLeaveDoc>(
        `${BASE}/applications/${encodeURIComponent(id)}${qs({ projectId })}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),

  deleteApplication: (
    projectId: string,
    id: string,
  ): Promise<{ ok?: boolean; deleted?: boolean }> =>
    rustFetch<{ ok?: boolean; deleted?: boolean }>(
      `${BASE}/applications/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),

  /**
   * `POST /applications/{id}/approve` — flips a `pending` application
   * to `approved` and appends an `ApproverStep` (the caller becomes the
   * approver). Non-pending applications return 409. NB: the engine has
   * no reject/cancel action on this mount today.
   */
  approveApplication: async (
    projectId: string,
    id: string,
    comment?: string,
  ): Promise<CrmLeaveDoc> =>
    deflateDoc(
      await rustFetch<CrmLeaveDoc>(
        `${BASE}/applications/${encodeURIComponent(id)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ projectId, comment: comment || undefined }),
        },
      ),
    ),
};

/** Re-export for the actions' attachment plumbing. */
export type SabcrmLeaveAttachment = CrmLeaveAttachment;
