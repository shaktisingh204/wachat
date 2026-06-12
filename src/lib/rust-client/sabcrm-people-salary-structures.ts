import 'server-only';

/**
 * SabCRM People — Salary Structures client. Wraps the project-scoped
 * `/v1/sabcrm/people/salary-structures` mount (crate
 * `crm-salary-structures`, `project_router` → `rich.rs` handlers) per
 * people-suite WI-8/WI-15/WI-16.
 *
 * Unlike the other People-suite mounts, this surface CRUDs the
 * **canonical rich** `hrm_payroll_types::SalaryStructure` shape (`name`,
 * `effectiveDate`, `components[]`, `applicableTo[]`, `active`) that
 * payroll compute consumes — NOT the legacy flat `CrmSalaryStructure`
 * (`employeeId`/`basic`/`hra`/…) which stays on the user-scoped
 * `/v1/crm/salary-structures` mount only (§2.1.2 schema-collision fix).
 *
 * ⚠ The rich entity serializes ObjectId/DateTime fields as MongoDB
 * extended JSON (`{$oid}` / `{$date}`) — callers MUST pass fetched
 * documents through `deflateDoc`/`deflateDocs`
 * (`@/lib/sabcrm/finance-extjson`).
 */
import { rustFetch } from './fetcher';

/* ─── Rich wire shapes (hrm_payroll_types::SalaryStructure) ─────── */

export type SabcrmSalaryComponentType =
  | 'earning'
  | 'deduction'
  | 'reimbursement';

/**
 * Calculation strategy — internally tagged on `kind`:
 *   `{ kind: "fixed", amount }` | `{ kind: "percent_basic", pct }` |
 *   `{ kind: "percent_ctc", pct }` | `{ kind: "formula", expr }`.
 */
export type SabcrmCalcKind =
  | { kind: 'fixed'; amount: number }
  | { kind: 'percent_basic'; pct: number }
  | { kind: 'percent_ctc'; pct: number }
  | { kind: 'formula'; expr: string };

export type SabcrmComponentFrequency = 'monthly' | 'quarterly' | 'annually';

/**
 * Targeting rule — `{ kind, id }` where `id` is an ObjectId hex for
 * employee/department and a free-text grade code for grade.
 */
export type SabcrmApplicability =
  | { kind: 'employee'; id: string }
  | { kind: 'department'; id: string }
  | { kind: 'grade'; id: string };

export interface SabcrmSalaryComponent {
  /** Display name (e.g. "House Rent Allowance"). */
  name: string;
  /** Stable short code used by formulas + payslip lines (e.g. "HRA"). */
  code: string;
  type: SabcrmSalaryComponentType;
  calc: SabcrmCalcKind;
  taxable?: boolean;
  statutory?: boolean;
  prorate?: boolean;
  frequency?: SabcrmComponentFrequency;
  maxCap?: number;
  minCap?: number;
}

export interface SabcrmSalaryStructureDoc {
  _id: string;
  /* crm-core fragments (flattened to root) */
  projectId?: string;
  userId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  name: string;
  effectiveDate: string;
  components?: SabcrmSalaryComponent[];
  applicableTo?: SabcrmApplicability[];
  /** Absent on the wire when `true` (serde `skip_serializing_if`). */
  active?: boolean;
}

export interface SabcrmSalaryStructureListParams {
  page?: number;
  limit?: number;
  /** Substring match over `name`. */
  q?: string;
  /** Filter on the `active` flag; absent = all. */
  active?: boolean;
}

export interface SabcrmSalaryStructureListResponse {
  items: SabcrmSalaryStructureDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcrmSalaryStructureCreateInput {
  name: string;
  effectiveDate: string;
  components?: SabcrmSalaryComponent[];
  applicableTo?: SabcrmApplicability[];
  active?: boolean;
}

export type SabcrmSalaryStructureUpdateInput =
  Partial<SabcrmSalaryStructureCreateInput>;

const BASE = '/v1/sabcrm/people/salary-structures';

function qs(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabcrmPeopleSalaryStructuresApi = {
  /** `GET /v1/sabcrm/people/salary-structures` — paginated rich list. */
  list: (
    projectId: string,
    params?: SabcrmSalaryStructureListParams,
  ): Promise<SabcrmSalaryStructureListResponse> =>
    rustFetch<SabcrmSalaryStructureListResponse>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        active: params?.active,
      })}`,
    ),

  /** `GET /{id}` — one rich structure. */
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmSalaryStructureDoc> =>
    rustFetch<SabcrmSalaryStructureDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),

  /** `POST /` — create a rich structure under the project scope. */
  create: (
    projectId: string,
    input: SabcrmSalaryStructureCreateInput,
  ): Promise<{ id: string; entity: SabcrmSalaryStructureDoc }> =>
    rustFetch<{ id: string; entity: SabcrmSalaryStructureDoc }>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),

  /** `PATCH /{id}` — partial update (every rich field patchable). */
  update: (
    projectId: string,
    id: string,
    patch: SabcrmSalaryStructureUpdateInput,
  ): Promise<SabcrmSalaryStructureDoc> =>
    rustFetch<SabcrmSalaryStructureDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /{id}`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
