/**
 * SabCRM People — Payroll Runs action types (client-safe).
 *
 * Shared vocabulary between `sabcrm-people-payroll-runs.actions.ts`
 * and the `/sabcrm/people/payroll-runs` surfaces. No server imports —
 * client components import from here freely.
 */

import type {
  CrmPayrollRunApprovalStep,
  CrmPayrollRunBankFileFormat,
  CrmPayrollRunDoc,
  CrmPayrollRunEmployeeRow,
  CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';
import type { DocStatusDef } from '@/app/sabcrm/finance/_components/doc-surface/types';

/* ─── Status vocabulary (mirrors PayrollRunStatus) ──────────────── */

export const PAYROLL_RUN_STATUSES: (DocStatusDef & {
  value: CrmPayrollRunStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'processing', label: 'Processing', tone: 'info' },
  { value: 'approved', label: 'Approved', tone: 'warning' },
  { value: 'disbursed', label: 'Disbursed', tone: 'success' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (`processing` renders off-path). */
export const PAYROLL_RUN_FLOW: CrmPayrollRunStatus[] = [
  'draft',
  'approved',
  'disbursed',
  'closed',
];

export const PAYROLL_RUN_BANK_FILE_FORMATS: {
  value: CrmPayrollRunBankFileFormat;
  label: string;
}[] = [
  { value: 'neft', label: 'NEFT' },
  { value: 'imps', label: 'IMPS' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'upi_bulk', label: 'UPI bulk' },
];

export function bankFileFormatLabel(
  value: CrmPayrollRunBankFileFormat | string | undefined,
): string | null {
  if (!value) return null;
  return (
    PAYROLL_RUN_BANK_FILE_FORMATS.find((f) => f.value === value)?.label ?? value
  );
}

/* ─── List ──────────────────────────────────────────────────────── */

export interface SabcrmPayrollRunListFilters {
  page: number;
  /** Free-text over the period label — applied as a page post-filter
   *  (the engine list supports only `status`; see actions docstring). */
  q?: string;
  status: CrmPayrollRunStatus | '';
  /** Inclusive `YYYY-MM-DD` bounds on `periodFrom` (page post-filter). */
  from?: string;
  to?: string;
}

export interface SabcrmPayrollRunListRow {
  id: string;
  periodFrom: string;
  periodTo: string;
  /** "1 Apr 2026 – 30 Apr 2026" style display label. */
  periodLabel: string;
  payDate: string | null;
  lockDate: string | null;
  employeeCount: number;
  gross: number;
  net: number;
  ctc: number;
  bankFileFormat: CrmPayrollRunBankFileFormat | null;
  status: CrmPayrollRunStatus;
  currency: string;
}

export interface SabcrmPayrollRunListPage {
  rows: SabcrmPayrollRunListRow[];
  hasMore: boolean;
}

/* ─── KPIs ──────────────────────────────────────────────────────── */

export interface SabcrmPayrollRunKpis {
  /** Σ totals.net over runs whose period falls in the current FY. */
  fyNetTotal: number;
  /** Net of the most recent computed run (by periodTo). */
  lastRunNet: number;
  lastRunLabel: string | null;
  /** Employee count paid in the most recent disbursed/closed run. */
  headcountPaid: number;
  /** Earliest upcoming payDate among draft/processing/approved runs. */
  nextPayDate: string | null;
  runCount: number;
  currency: string;
}

/* ─── Create / update inputs (full DTO field set) ───────────────── */

export interface SabcrmPayrollRunFormInput {
  /** `YYYY-MM-DD`. */
  periodFrom: string;
  /** `YYYY-MM-DD`. */
  periodTo: string;
  payDate?: string;
  lockDate?: string;
  bankFileFormat?: CrmPayrollRunBankFileFormat | '';
}

/* ─── Detail ────────────────────────────────────────────────────── */

/** One display-ready employee line (label resolved server-side). */
export interface SabcrmPayrollRunEmployeeView extends CrmPayrollRunEmployeeRow {
  employeeLabel: string;
}

/** Approval step with the approver label resolved. */
export interface SabcrmPayrollRunApprovalView extends CrmPayrollRunApprovalStep {
  approverLabel: string;
}

/** A generated payslip stub for the lineage rail. */
export interface SabcrmPayrollRunPayslipRef {
  id: string;
  employeeLabel: string;
  netPay: number;
  sent: boolean;
}

export interface SabcrmPayrollRunDetail {
  run: CrmPayrollRunDoc;
  employees: SabcrmPayrollRunEmployeeView[];
  approvals: SabcrmPayrollRunApprovalView[];
  payslips: SabcrmPayrollRunPayslipRef[];
}
