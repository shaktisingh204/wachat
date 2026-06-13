/**
 * SabCRM People — payslip surface config (client-safe).
 *
 * Route helpers + kit-filter mapping for `/sabcrm/people/payslips`
 * (people-suite WI-33). The dual-shape status vocabulary (rich
 * `generated` + flat draft/issued/paid/archived) lives in the shared
 * action types — re-exported here so the surfaces import one module.
 * No server imports.
 */

import type { DocListFilters } from '../../finance/_components/doc-surface/types';
import {
  PAYSLIP_RICH_STATUS,
  PAYSLIP_STATUSES,
  type SabcrmPayslipListFilters,
} from '@/app/actions/sabcrm-people-payslips.actions.types';

export {
  PAYSLIP_FLAT_FLOW,
  PAYSLIP_RICH_DETAIL_STATUSES,
  PAYSLIP_RICH_FLOW,
  PAYSLIP_RICH_STATUS,
  PAYSLIP_STATUSES,
  isRichSabcrmPayslip,
} from '@/app/actions/sabcrm-people-payslips.actions.types';

export const PEOPLE_PAYSLIPS_PATH = '/sabcrm/people/payslips';
export const PEOPLE_PAYROLL_RUNS_PATH = '/sabcrm/people/payroll-runs';

export function payslipDetailHref(id: string): string {
  return `${PEOPLE_PAYSLIPS_PATH}/${encodeURIComponent(id)}`;
}

export function payrollRunDetailHref(id: string): string {
  return `${PEOPLE_PAYROLL_RUNS_PATH}/${encodeURIComponent(id)}`;
}

export function peopleEmployeeHref(id: string): string {
  return `/sabcrm/people/employees/${encodeURIComponent(id)}`;
}

/** Flat-shape detail vocabulary (everything except the synthetic rich status). */
export const PAYSLIP_FLAT_DETAIL_STATUSES = PAYSLIP_STATUSES.filter(
  (s) => s.value !== PAYSLIP_RICH_STATUS,
);

/**
 * Kit list filters → payslip action filters. The kit's `partyId` is
 * repurposed as the EMPLOYEE filter (the toolbar picker searches
 * employees); `runId` is a deep-link-only filter held outside the
 * toolbar (`?runId=` from the payroll-run lineage rail).
 */
export function toPayslipFilters(
  f: DocListFilters,
  runId?: string | null,
): SabcrmPayslipListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: f.status || '',
    employeeId: f.partyId || undefined,
    runId: runId || undefined,
    from: f.from,
    to: f.to,
  };
}
