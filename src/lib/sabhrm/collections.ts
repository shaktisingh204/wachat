/**
 * SabHRM collection names.
 *
 * SabHRM has its own fresh, self-contained backend (native Mongo, no Rust
 * crate). Every collection is scoped by `workspaceId` (= the selected
 * `kind:'hrm'` project `_id` string) so data is isolated per organization.
 */
export const SABHRM_COLLECTIONS = {
  employees: 'sabhrm_employees',
  departments: 'sabhrm_departments',
  designations: 'sabhrm_designations',
  attendance: 'sabhrm_attendance',
  leaveRequests: 'sabhrm_leave_requests',
  leaveTypes: 'sabhrm_leave_types',
  holidays: 'sabhrm_holidays',
  shifts: 'sabhrm_shifts',
  timeLogs: 'sabhrm_time_logs',
  salaryStructures: 'sabhrm_salary_structures',
  payrollRuns: 'sabhrm_payroll_runs',
  payslips: 'sabhrm_payslips',
  goals: 'sabhrm_goals',
  reviews: 'sabhrm_reviews',
} as const;

export type SabHrmCollection =
  (typeof SABHRM_COLLECTIONS)[keyof typeof SABHRM_COLLECTIONS];
