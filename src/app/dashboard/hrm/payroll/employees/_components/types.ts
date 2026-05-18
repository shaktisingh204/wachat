/**
 * Shared types for the canonical Employees module client islands.
 *
 * `EmployeeListRow` is the wire-format the server `page.tsx` projects
 * its docs into before handing them off to client tables / grids /
 * org-chart. IDs are stringified so the components stay serialization-
 * safe.
 *
 * Mirrors the §1D contract used by `<InvoiceListClient>` so the two
 * surfaces share the same KPI/filter/preset vocabulary.
 */

import type { CrmEmployeeStatus, CrmEmployeeType } from '@/lib/rust-client/crm-employees';

export interface EmployeeListRow {
  _id: string;
  /** Stable employee code, e.g. "EMP-0042". */
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  photoFileId?: string;
  workEmail?: string;
  workPhone?: string;
  personalPhone?: string;
  departmentId?: string | null;
  designationId?: string | null;
  designation?: string;
  reportingManagerId?: string | null;
  status?: CrmEmployeeStatus | string;
  employmentType?: CrmEmployeeType | string;
  joiningDate?: string | null;
  exitDate?: string | null;
  workLocation?: string;
  ctc?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeKpiSnapshot {
  total: number;
  active: number;
  onLeave: number;
  /** Status === 'resigned' — i.e. notice period in progress. */
  onNotice: number;
  /** Employees whose joiningDate falls in the current calendar month. */
  newThisMonth: number;
  terminated: number;
  /** Mean tenure across active employees, in whole months. */
  avgTenureMonths: number | null;
}

export type EmployeePresetKey =
  | 'all-active'
  | 'my-team'
  | 'on-probation'
  | 'joined-last-30d'
  | 'joined-this-month'
  | 'on-leave'
  | 'on-notice'
  | 'terminated';

export type EmployeeViewMode = 'table' | 'grid' | 'org';
