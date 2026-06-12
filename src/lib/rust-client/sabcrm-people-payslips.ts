import 'server-only';

/**
 * SabCRM People — Payslips client. Wraps the project-scoped
 * `/v1/sabcrm/people/payslips` mount (crate `crm-payslips`,
 * `project_router`) per people-suite WI-9/WI-15/WI-16.
 *
 * ## Dual shape (people-suite WI-9 / risk R7)
 *
 * `crm_payslips` holds TWO document shapes and the engine returns the
 * untagged `UnifiedPayslip` union:
 *
 * - the rich, render-ready `hrm_payroll_types::Payslip` written by
 *   `crm-payroll-runs::generate_payslips` — carries `runId`
 *   ({@link SabcrmRichPayslipDoc});
 * - the legacy FLAT `CrmPayslip` written by the crate's CRUD — no
 *   `runId` ({@link CrmPayslipDoc} re-used from `./crm-payslips`).
 *
 * TS callers branch on `runId` presence via {@link SabcrmUnifiedPayslipDoc}
 * (use the `isRichSabcrmPayslip` guard exported from the payslips
 * actions `.types.ts`, which is client-safe). Rich payslips are
 * READ-ONLY through this surface — `PATCH`/`DELETE` reject them with a
 * 409; the only legal mutation is `markSent`.
 *
 * ⚠ Both shapes serialize ObjectId/DateTime fields as MongoDB extended
 * JSON (`{$oid}` / `{$date}`) — callers MUST pass fetched documents
 * through `deflateDoc`/`deflateDocs` (`@/lib/sabcrm/finance-extjson`).
 */
import { rustFetch } from './fetcher';
import type {
  CrmPayslipDoc,
  CrmPayslipStatus,
  CrmPayslipUpdateInput,
} from './crm-payslips';

export type {
  CrmPayslipDoc,
  CrmPayslipStatus,
  CrmPayslipUpdateInput,
} from './crm-payslips';

/* ─── Rich payslip wire shape (hrm_payroll_types::Payslip) ──────── */

export interface SabcrmPayslipMoneyLine {
  code: string;
  label: string;
  amount: number;
}

export interface SabcrmPayslipReimbursementLine {
  category: string;
  amount: number;
  claimId?: string;
}

export interface SabcrmPayslipHeader {
  companyName: string;
  companyLogoFileId?: string;
  periodLabel: string;
}

export interface SabcrmPayslipEmployeeSnapshot {
  employeeId: string;
  name: string;
  designation?: string;
  department?: string;
  /** Public-facing employee code (e.g. "EMP-0042"). */
  employmentId: string;
  joiningDate?: string;
  pan?: string;
  uan?: string;
  esic?: string;
}

export interface SabcrmPayslipYtd {
  gross: number;
  net: number;
  taxPaid: number;
}

export interface SabcrmPayslipAttendanceSummary {
  workingDays: number;
  present: number;
  leaves: number;
  holidays: number;
  /** Loss-of-pay days. */
  lop: number;
}

export interface SabcrmPayslipBankInfo {
  bankName: string;
  accountNoMasked: string;
  ifsc: string;
  nameOnAccount: string;
}

export interface SabcrmPayslipDownloadedEntry {
  at: string;
  by: string;
  ip?: string;
}

/** Frozen render-ready payslip generated from a payroll run (WI-7). */
export interface SabcrmRichPayslipDoc {
  _id: string;
  /* crm-core fragments (flattened to root) */
  projectId?: string;
  userId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  /* back-refs */
  runId: string;
  employeeId: string;

  /* period */
  periodFrom: string;
  periodTo: string;

  /* frozen snapshots */
  header: SabcrmPayslipHeader;
  employeeSnapshot: SabcrmPayslipEmployeeSnapshot;

  /* money tables */
  earnings?: SabcrmPayslipMoneyLine[];
  deductions?: SabcrmPayslipMoneyLine[];
  reimbursements?: SabcrmPayslipReimbursementLine[];

  /* net pay */
  netPay: number;
  /** Indian-format spelled-out amount. */
  netPayInWords: string;

  /* supporting context */
  ytd?: SabcrmPayslipYtd;
  attendanceSummary?: SabcrmPayslipAttendanceSummary;
  /** Opaque map of leave-type-code → remaining balance. */
  leaveBalanceSnapshot?: Record<string, number> | null;
  bankInfoSnapshot: SabcrmPayslipBankInfo;

  /* render assets (SabFile ids) */
  signatureFileId?: string;
  watermarkFileId?: string;

  /* workflow + delivery */
  locked?: boolean;
  sent?: boolean;
  sentAt?: string;
  downloadedLog?: SabcrmPayslipDownloadedEntry[];
}

/** The unified wire union the engine returns (branch on `runId`). */
export type SabcrmUnifiedPayslipDoc = SabcrmRichPayslipDoc | CrmPayslipDoc;

export interface SabcrmPayslipListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmPayslipStatus | string;
  employeeId?: string;
  /** Restrict to payslips generated from one payroll run (rich only). */
  runId?: string;
  payPeriod?: string;
}

export interface SabcrmPayslipListResponse {
  items: SabcrmUnifiedPayslipDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

const BASE = '/v1/sabcrm/people/payslips';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabcrmPeoplePayslipsApi = {
  /** `GET /v1/sabcrm/people/payslips` — unified dual-shape page. */
  list: (
    projectId: string,
    params?: SabcrmPayslipListParams,
  ): Promise<SabcrmPayslipListResponse> =>
    rustFetch<SabcrmPayslipListResponse>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        employeeId: params?.employeeId,
        runId: params?.runId,
        payPeriod: params?.payPeriod,
      })}`,
    ),

  /** `GET /v1/sabcrm/people/payslips/{id}` — one payslip (either shape). */
  getById: (projectId: string, id: string): Promise<SabcrmUnifiedPayslipDoc> =>
    rustFetch<SabcrmUnifiedPayslipDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),

  /**
   * `POST /{id}/mark-sent` — delivery verb (legal on both shapes;
   * the only legal mutation for rich payslips).
   */
  markSent: (
    projectId: string,
    id: string,
  ): Promise<SabcrmUnifiedPayslipDoc> =>
    rustFetch<SabcrmUnifiedPayslipDoc>(
      `${BASE}/${encodeURIComponent(id)}/mark-sent${qs({ projectId })}`,
      { method: 'POST' },
    ),

  /** `PATCH /{id}` — FLAT payslips only (rich ⇒ engine 409). */
  update: (
    projectId: string,
    id: string,
    patch: CrmPayslipUpdateInput,
  ): Promise<SabcrmUnifiedPayslipDoc> =>
    rustFetch<SabcrmUnifiedPayslipDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /{id}` — FLAT payslips only (rich ⇒ engine 409). */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
