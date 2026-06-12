/**
 * SabCRM People — payroll-run surface config (client-safe).
 *
 * Route helpers + kit-filter mapping for `/sabcrm/people/payroll-runs`
 * (people-suite WI-32). The status vocabulary, happy-path flow and
 * bank-file-format options live in the shared action types
 * (`sabcrm-people-payroll-runs.actions.types`) — re-exported here so
 * the surface imports one module. No server imports.
 */

import type { CrmPayrollRunStatus } from '@/lib/rust-client/crm-payroll-runs';
import type { DocListFilters } from '../../finance/_components/doc-surface/types';
import type { SabcrmPayrollRunListFilters } from '@/app/actions/sabcrm-people-payroll-runs.actions.types';

export {
  PAYROLL_RUN_BANK_FILE_FORMATS,
  PAYROLL_RUN_FLOW,
  PAYROLL_RUN_STATUSES,
  bankFileFormatLabel,
} from '@/app/actions/sabcrm-people-payroll-runs.actions.types';

export const PEOPLE_PAYROLL_RUNS_PATH = '/sabcrm/people/payroll-runs';
export const PEOPLE_PAYSLIPS_PATH = '/sabcrm/people/payslips';
export const PEOPLE_SETTINGS_PATH = '/sabcrm/people/settings';

export function payrollRunDetailHref(id: string): string {
  return `${PEOPLE_PAYROLL_RUNS_PATH}/${encodeURIComponent(id)}`;
}

export function payslipDetailHref(id: string): string {
  return `${PEOPLE_PAYSLIPS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * Kit list filters → payroll-run action filters. There is no party on
 * this entity (`partyId` is ignored); `q` and the date range are page
 * post-filters applied action-side (the engine list supports only
 * `status`).
 */
export function toPayrollRunFilters(
  f: DocListFilters,
): SabcrmPayrollRunListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmPayrollRunStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}
