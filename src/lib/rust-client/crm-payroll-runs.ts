import 'server-only';

/**
 * CRM Payroll Run client — wraps `/v1/hrm/payroll-runs`.
 *
 * Counterpart of the Rust crate `crm-payroll-runs`. The Rust handlers
 * return the full `PayrollRun` document on every read/write endpoint;
 * this module narrows the shape into a TS-friendly `CrmPayrollRunDoc`
 * and provides camelCase access for the UI layer.
 *
 * Beyond the five standard CRUD calls, the Rust crate exposes three
 * lifecycle endpoints — `compute`, `approve`, `disburse` — which mutate
 * `status` + `employees[]` / `approvals[]` / `bankFileId` and live as
 * separate methods here.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror hrm_payroll_types::PayrollRun ───────── */

export type CrmPayrollRunStatus =
  | 'draft'
  | 'processing'
  | 'approved'
  | 'disbursed'
  | 'closed';

export type CrmPayrollRunBankFileFormat = 'neft' | 'imps' | 'rtgs' | 'upi_bulk';

export interface CrmPayrollRunEarningLine {
  code: string;
  label: string;
  amount: number;
}

export interface CrmPayrollRunDeductionLine {
  code: string;
  label: string;
  amount: number;
}

export interface CrmPayrollRunReimbursementLine {
  category: string;
  amount: number;
  claimId?: string;
}

export interface CrmPayrollRunEmployeeRow {
  employeeId: string;
  earnings?: CrmPayrollRunEarningLine[];
  deductions?: CrmPayrollRunDeductionLine[];
  reimbursements?: CrmPayrollRunReimbursementLine[];
  gross: number;
  net: number;
  ctc: number;
}

export interface CrmPayrollRunTotals {
  gross: number;
  net: number;
  ctc: number;
  employeeCount: number;
}

export interface CrmPayrollRunApprovalStep {
  approverId: string;
  status: string;
  decidedAt?: string;
  comment?: string;
}

export interface CrmPayrollRunDoc {
  _id: string;
  /* crm-core fragments (flattened to root) */
  projectId?: string;
  userId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  /* period + dates */
  periodFrom: string;
  periodTo: string;
  payDate?: string;
  lockDate?: string;

  /* per-employee figures + rollup */
  employees?: CrmPayrollRunEmployeeRow[];
  totals?: CrmPayrollRunTotals;

  /* bank file */
  bankFileFormat?: CrmPayrollRunBankFileFormat;
  bankFileId?: string;

  /* workflow */
  status?: CrmPayrollRunStatus;
  approvals?: CrmPayrollRunApprovalStep[];

  archived?: boolean;
}

export interface CrmPayrollRunListParams {
  page?: number;
  limit?: number;
  status?: CrmPayrollRunStatus | string;
}

export interface CrmPayrollRunCreateInput {
  periodFrom: string;
  periodTo: string;
  payDate?: string;
  lockDate?: string;
  bankFileFormat?: CrmPayrollRunBankFileFormat | string;
  projectId?: string;
}

export type CrmPayrollRunUpdateInput = Partial<
  Omit<CrmPayrollRunCreateInput, 'projectId'>
>;

export interface CrmPayrollRunApproveInput {
  approverId: string;
  comment?: string;
}

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmPayrollRunListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.status) qs.set('status', String(p.status));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/hrm/payroll-runs';

export const crmPayrollRunsApi = {
  list: (params?: CrmPayrollRunListParams) =>
    rustFetch<CrmPayrollRunDoc[]>(`${BASE}${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmPayrollRunDoc>(`${BASE}/${encodeURIComponent(id)}`),
  create: (input: CrmPayrollRunCreateInput) =>
    rustFetch<CrmPayrollRunDoc>(BASE, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmPayrollRunUpdateInput) =>
    rustFetch<CrmPayrollRunDoc>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  /**
   * `POST /{id}/compute` — resolve the active roster against each
   * employee's salary structure and populate `employees[]` + `totals`.
   * Legal only when the run is in `draft` or `processing`.
   */
  compute: (id: string) =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}/compute`,
      { method: 'POST' },
    ),
  /**
   * `POST /{id}/approve` — append one `ApprovalStep` to the run. Single
   * approver flips status → `approved`.
   */
  approve: (id: string, input: CrmPayrollRunApproveInput) =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  /**
   * `POST /{id}/disburse` — stub-generate the bank file and flip status
   * → `disbursed`. Legal only when the run is `approved`.
   */
  disburse: (id: string) =>
    rustFetch<CrmPayrollRunDoc>(
      `${BASE}/${encodeURIComponent(id)}/disburse`,
      { method: 'POST' },
    ),
};
