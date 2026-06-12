import 'server-only';

/**
 * SabCRM People — Payroll Runs client. Wraps the project-scoped
 * `/v1/sabcrm/people/payroll-runs` mount (crate `crm-payroll-runs`,
 * `project_router`) per people-suite WI-15/WI-16.
 *
 * Same handlers + `crm_payroll_runs` collection as the legacy
 * `/v1/hrm/payroll-runs` mount, but every request must carry the active
 * SabCRM `projectId` (query string for GET/PATCH/DELETE and the
 * body-less lifecycle POSTs, body for POST /) — the Rust side rejects
 * requests without it (`sabcrm_project_oid` → 4xx). Membership of the
 * project is validated by the gated server actions BEFORE calling this
 * client; never call it with an unvalidated projectId.
 *
 * Wire shapes are identical to the legacy mount, so the document/input
 * types are re-used from `./crm-payroll-runs`.
 *
 * ⚠ The gen-1 `PayrollRun` entity serializes ObjectId/DateTime fields
 * as MongoDB extended JSON (`{$oid}` / `{$date}`) — callers MUST pass
 * every fetched document through `deflateDoc`/`deflateDocs`
 * (`@/lib/sabcrm/finance-extjson`) before use.
 *
 * This file also hosts a minimal read-only employees client
 * (`sabcrmPeoplePayrollEmployeesApi`) over
 * `/v1/sabcrm/people/employees` so the payroll/payslip/time-log action
 * files can resolve employee labels without sharing files with the
 * employees-surface agent.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';
import type {
  CrmPayrollRunApproveInput,
  CrmPayrollRunCreateInput,
  CrmPayrollRunDoc,
  CrmPayrollRunListParams,
  CrmPayrollRunUpdateInput,
} from './crm-payroll-runs';
import type { CrmEmployeeDoc, CrmEmployeeStatus } from './crm-employees';

export type {
  CrmPayrollRunApprovalStep,
  CrmPayrollRunApproveInput,
  CrmPayrollRunBankFileFormat,
  CrmPayrollRunCreateInput,
  CrmPayrollRunDeductionLine,
  CrmPayrollRunDoc,
  CrmPayrollRunEarningLine,
  CrmPayrollRunEmployeeRow,
  CrmPayrollRunListParams,
  CrmPayrollRunReimbursementLine,
  CrmPayrollRunStatus,
  CrmPayrollRunTotals,
  CrmPayrollRunUpdateInput,
} from './crm-payroll-runs';
export type { CrmEmployeeDoc } from './crm-employees';

/** `POST /{runId}/generate-payslips` response (people-suite WI-7). */
export interface SabcrmGeneratePayslipsResponse {
  /** Employee rows processed (upserted or refreshed). */
  generated: number;
  /** Employee rows skipped (missing employee document). */
  skipped: number;
  /** `_id`s of every payslip belonging to this run (hex). */
  payslipIds: string[];
}

const BASE = '/v1/sabcrm/people/payroll-runs';
const EMPLOYEES_BASE = '/v1/sabcrm/people/employees';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabcrmPeoplePayrollRunsApi = {
  /** `GET /v1/sabcrm/people/payroll-runs` — bare array, 1-indexed pages. */
  list: (
    projectId: string,
    params?: CrmPayrollRunListParams,
  ): Promise<CrmPayrollRunDoc[]> =>
    rustFetch<CrmPayrollRunDoc[]>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),

  /** `GET /v1/sabcrm/people/payroll-runs/{id}` — single run (404 ⇒ throws). */
  getById: (projectId: string, id: string): Promise<CrmPayrollRunDoc> =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),

  /** `POST /v1/sabcrm/people/payroll-runs` — create under the project scope. */
  create: (
    projectId: string,
    input: CrmPayrollRunCreateInput,
  ): Promise<CrmPayrollRunDoc> =>
    rustFetch<CrmPayrollRunDoc>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),

  /** `PATCH /v1/sabcrm/people/payroll-runs/{id}` — partial update (draft fields). */
  update: (
    projectId: string,
    id: string,
    patch: CrmPayrollRunUpdateInput,
  ): Promise<CrmPayrollRunDoc> =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /v1/sabcrm/people/payroll-runs/{id}`. */
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok?: boolean; deleted?: boolean }> =>
    rustFetch<{ ok?: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),

  /**
   * `POST /{id}/compute` — resolve the project roster against each
   * employee's salary structure and populate `employees[]` + `totals`.
   * Legal only when the run is in `draft` or `processing`.
   */
  compute: (projectId: string, id: string): Promise<CrmPayrollRunDoc> =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}/compute${qs({ projectId })}`,
      { method: 'POST' },
    ),

  /**
   * `POST /{id}/approve` — append one `ApprovalStep`. Single approver
   * flips status → `approved`.
   */
  approve: (
    projectId: string,
    id: string,
    input: CrmPayrollRunApproveInput,
  ): Promise<CrmPayrollRunDoc> =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}/approve${qs({ projectId })}`,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),

  /**
   * `POST /{id}/disburse` — generate the bank file and flip status →
   * `disbursed`. Legal only when the run is `approved`.
   */
  disburse: (projectId: string, id: string): Promise<CrmPayrollRunDoc> =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}/disburse${qs({ projectId })}`,
      { method: 'POST' },
    ),

  /**
   * `POST /{id}/generate-payslips` (WI-7) — freeze one rich payslip per
   * employee row into `crm_payslips`. Run must be `approved` or
   * `disbursed`; idempotent per (runId, employeeId).
   */
  generatePayslips: (
    projectId: string,
    id: string,
  ): Promise<SabcrmGeneratePayslipsResponse> =>
    rustFetch<SabcrmGeneratePayslipsResponse>(
      `${BASE}/${encodeURIComponent(id)}/generate-payslips${qs({ projectId })}`,
      { method: 'POST' },
    ),
};

/* ═══ Minimal employees read client (label resolution + pickers) ═══ */

export interface SabcrmPeopleEmployeeListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmEmployeeStatus | string;
}

/**
 * Read-only employees access for the payroll-group action files
 * (employee pickers + batched label resolution). The full employees
 * surface (CRUD, KPIs) is owned by `sabcrm-people-employees.*` — this
 * namespace deliberately exposes reads only.
 */
export const sabcrmPeoplePayrollEmployeesApi = {
  /** `GET /v1/sabcrm/people/employees` — bare array, 1-indexed pages. */
  list: (
    projectId: string,
    params?: SabcrmPeopleEmployeeListParams,
  ): Promise<CrmEmployeeDoc[]> =>
    rustFetch<CrmEmployeeDoc[]>(
      `${EMPLOYEES_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),

  /** `GET /v1/sabcrm/people/employees/{id}` — single employee. */
  getById: (projectId: string, id: string): Promise<CrmEmployeeDoc> =>
    rustFetch<CrmEmployeeDoc>(
      `${EMPLOYEES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
};
