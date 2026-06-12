/**
 * SabCRM People — employee surface config (client-safe).
 *
 * The employee entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow for the StatusFlow rail, the employment-type /
 * gender select vocabularies (mirroring
 * `hrm_payroll_types::employee::*` snake_case wire values exactly) and
 * route helpers. Spec: `docs/sabcrm/rnd/people-suite.md` WI-24.
 */

import type {
  CrmEmployeeGender,
  CrmEmployeeStatus,
  CrmEmployeeType,
} from '@/lib/rust-client/crm-employees';
import type {
  DocListFilters,
  DocStatusDef,
} from '../../finance/_components/doc-surface/types';
import type { SabcrmEmployeeListFilters } from '@/app/actions/sabcrm-people-employees.actions.types';

export const EMPLOYEE_STATUSES: (DocStatusDef & {
  value: CrmEmployeeStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'on_leave', label: 'On leave', tone: 'warning' },
  { value: 'terminated', label: 'Terminated', tone: 'danger' },
  { value: 'resigned', label: 'Resigned', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const EMPLOYEE_FLOW: CrmEmployeeStatus[] = ['active'];

export const EMPLOYMENT_TYPES: { value: CrmEmployeeType; label: string }[] = [
  { value: 'full_time', label: 'Full time' },
  { value: 'part_time', label: 'Part time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'consultant', label: 'Consultant' },
];

export function employmentTypeLabel(
  value: CrmEmployeeType | '' | undefined,
): string {
  if (!value) return '';
  return EMPLOYMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export const EMPLOYEE_GENDERS: { value: CrmEmployeeGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/**
 * Kit list filters → employee action filters. The kit's `partyId` is
 * repurposed as the DEPARTMENT filter on this surface (the toolbar's
 * party picker searches departments); the date range maps to
 * `joiningDate` bounds.
 */
export function toEmployeeFilters(
  f: DocListFilters,
): SabcrmEmployeeListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmEmployeeStatus | '') || '',
    departmentId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const PEOPLE_EMPLOYEES_PATH = '/sabcrm/people/employees';

export function employeeDetailHref(id: string): string {
  return `${PEOPLE_EMPLOYEES_PATH}/${encodeURIComponent(id)}`;
}

export const PEOPLE_PAYSLIPS_PATH = '/sabcrm/people/payslips';
