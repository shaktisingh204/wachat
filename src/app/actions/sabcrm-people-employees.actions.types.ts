/**
 * SabCRM People — Employees action types.
 *
 * Shared between `sabcrm-people-employees.actions.ts` ('use server'
 * modules may only export async functions) and the
 * `/sabcrm/people/employees` surfaces. Mirrors the
 * `sabcrm-finance-invoices.actions.types.ts` convention.
 */

import type {
  CrmEmployeeGender,
  CrmEmployeeStatus,
  CrmEmployeeType,
  SabcrmEmployeeDoc,
} from '@/lib/rust-client/sabcrm-people-employees';

/* ─── Pickers ─────────────────────────────────────────────────── */

/** One option for the kit `EntityPicker` (employee / department / …). */
export interface SabcrmPeopleEntityOption {
  id: string;
  /** Human label — never a raw ObjectId. */
  label: string;
  /** Secondary line (`EMP-0001 · jane@acme.example`, dept code, …). */
  meta?: string;
}

/* ─── List page ───────────────────────────────────────────────── */

export interface SabcrmEmployeeListFilters {
  page: number;
  limit?: number;
  q?: string;
  status: CrmEmployeeStatus | '';
  /** Department FK (the list toolbar's party filter). */
  departmentId?: string;
  /** Inclusive `YYYY-MM-DD` bounds on `joiningDate`. */
  from?: string;
  to?: string;
}

/** Display-ready employee list row — labels resolved server-side. */
export interface SabcrmEmployeeListRow {
  id: string;
  /** Tenant-issued employee code ("EMP-0001"). */
  employeeCode: string;
  /** `displayName ?? firstName + lastName`. */
  name: string;
  workEmail: string;
  designation: string;
  departmentId: string;
  departmentLabel: string | null;
  employmentType: CrmEmployeeType | '';
  joiningDate?: string;
  ctc: number;
  currency: string;
  status: CrmEmployeeStatus;
}

export interface SabcrmEmployeeListPage {
  rows: SabcrmEmployeeListRow[];
  page: number;
  hasMore: boolean;
}

/* ─── KPIs ────────────────────────────────────────────────────── */

export interface SabcrmEmployeeKpis {
  headcount: number;
  active: number;
  onLeave: number;
  joinersThisMonth: number;
  /** True when the scan hit the cap (counts are over a sample). */
  sampled: boolean;
}

/* ─── Detail ──────────────────────────────────────────────────── */

/** Resolved FK labels for the detail page (null = unresolvable). */
export interface SabcrmEmployeeDetailLabels {
  department: string | null;
  designation: string | null;
  reportingManager: string | null;
  dottedLineManager: string | null;
  shift: string | null;
  salaryStructure: string | null;
}

export interface SabcrmEmployeeDetail {
  doc: SabcrmEmployeeDoc;
  labels: SabcrmEmployeeDetailLabels;
}

/** One row in the detail Activity rail (attendance / leave / payslip). */
export interface SabcrmEmployeeActivityRef {
  id: string;
  label: string;
  date?: string;
  status?: string;
  amount?: number;
  currency?: string;
  href: string | null;
}

export interface SabcrmEmployeeActivity {
  /** Attendance rows from the last 30 days. */
  attendance: SabcrmEmployeeActivityRef[];
  leaves: SabcrmEmployeeActivityRef[];
  payslips: SabcrmEmployeeActivityRef[];
}

/* ─── Form values ─────────────────────────────────────────────── */

/**
 * What the create form submits — mirrors the engine
 * `crm_employees::dto::CreateEmployeeInput` exactly (dates as
 * `YYYY-MM-DD`, coerced to RFC3339 server-side).
 */
export interface SabcrmEmployeeCreateValues {
  /* identity */
  salutation?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  dob: string;
  gender?: CrmEmployeeGender | '';
  /* contact */
  personalEmail?: string;
  personalPhone?: string;
  workEmail: string;
  workPhone?: string;
  /* employment */
  joiningDate: string;
  departmentId: string;
  designationId: string;
  employmentType?: CrmEmployeeType | '';
  reportingManagerId?: string;
  dottedLineManagerId?: string;
  status?: CrmEmployeeStatus | '';
  /* compensation */
  salaryStructureId: string;
  ctc?: number;
  variablePct?: number;
  noticePeriodDays?: number;
}

/** Every create field optional — the engine PATCHes only sent fields. */
export type SabcrmEmployeeUpdateValues = Partial<SabcrmEmployeeCreateValues>;
