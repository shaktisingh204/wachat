/**
 * SabHRM shared domain types.
 *
 * These describe the SabHRM data model (native Mongo, scoped per
 * `workspaceId`). Server actions return DTOs with `_id` already stringified
 * and dates serialized to ISO strings so they cross the server→client
 * boundary cleanly. `*Doc` shapes (with ObjectId/Date) live inline in the
 * action files; the client-facing rows are defined here.
 */

/* ── Result envelope ─────────────────────────────────────────────────── */

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  departmentId?: string;
  from?: string;
  to?: string;
}

/* ── Enums ───────────────────────────────────────────────────────────── */

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'intern'
  | 'consultant';

export type EmployeeStatus =
  | 'active'
  | 'probation'
  | 'on_leave'
  | 'resigned'
  | 'terminated';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'late'
  | 'on_leave'
  | 'holiday'
  | 'week_off';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type PayrollStatus = 'draft' | 'computed' | 'approved' | 'paid';

export type PayslipStatus = 'generated' | 'sent';

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export type ReviewStatus = 'draft' | 'submitted' | 'acknowledged';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
  consultant: 'Consultant',
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  probation: 'Probation',
  on_leave: 'On leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
};

/* ── Employee ────────────────────────────────────────────────────────── */

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  dateOfJoining: string | null;
  workLocation: string | null;
  ctc: number | null;
  photoUrl: string | null;
  /** Linked login user id (created via email+password onboarding). */
  userId: string | null;
}

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  email: string;
  /** Plaintext password — only used at create time to mint the login. */
  password?: string;
  phone?: string;
  departmentId?: string;
  designationId?: string;
  reportingManagerId?: string;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  dateOfJoining?: string;
  workLocation?: string;
  ctc?: number;
  salaryStructureId?: string;
  /** Statutory */
  pan?: string;
  uan?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
}

/* ── Org structure ───────────────────────────────────────────────────── */

export interface DepartmentRow {
  id: string;
  name: string;
  code: string | null;
  headEmployeeId: string | null;
  headEmployeeName: string | null;
  employeeCount: number;
}

export interface DesignationRow {
  id: string;
  name: string;
  level: number | null;
  departmentId: string | null;
  departmentName: string | null;
  employeeCount: number;
}

/* ── Time & attendance ───────────────────────────────────────────────── */

export interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  note: string | null;
}

export interface ShiftRow {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  weekOffs: number[]; // 0=Sun..6=Sat
  active: boolean;
  employeeCount: number;
}

export interface HolidayRow {
  id: string;
  name: string;
  date: string;
  type: 'public' | 'restricted' | 'company';
  recurring: boolean;
}

export interface TimeLogRow {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  project: string | null;
  task: string | null;
  hours: number;
  billable: boolean;
  approved: boolean;
}

/* ── Leave ───────────────────────────────────────────────────────────── */

export interface LeaveTypeRow {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  paid: boolean;
  carryForward: boolean;
  color: string | null;
}

export interface LeaveRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  from: string;
  to: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  appliedAt: string;
}

/* ── Payroll ─────────────────────────────────────────────────────────── */

export interface SalaryComponent {
  name: string;
  /** 'earning' adds to gross; 'deduction' subtracts. */
  kind: 'earning' | 'deduction';
  /** Either a flat amount or a % of basic. */
  calc: 'flat' | 'percent_of_basic';
  value: number;
}

export interface SalaryStructureRow {
  id: string;
  name: string;
  ctc: number;
  components: SalaryComponent[];
  employeeCount: number;
}

export interface PayrollRunRow {
  id: string;
  label: string;
  periodMonth: number; // 1-12
  periodYear: number;
  status: PayrollStatus;
  employeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  netTotal: number;
  computedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface PayslipRow {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  periodLabel: string;
  gross: number;
  deductions: number;
  net: number;
  status: PayslipStatus;
}

/* ── Performance ─────────────────────────────────────────────────────── */

export interface GoalRow {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description: string | null;
  metric: string | null;
  target: number | null;
  progress: number; // 0-100
  dueDate: string | null;
  status: GoalStatus;
}

export interface ReviewRow {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerId: string | null;
  reviewerName: string | null;
  cycle: string;
  rating: number | null; // 1-5
  status: ReviewStatus;
  submittedAt: string | null;
}

/* ── Dashboard ───────────────────────────────────────────────────────── */

export interface SabHrmDashboardData {
  headcount: number;
  activeCount: number;
  onLeaveToday: number;
  presentToday: number;
  pendingLeaveApprovals: number;
  openPositions: number;
  departmentCount: number;
  latestPayrollStatus: PayrollStatus | null;
  upcoming: Array<{
    kind: 'birthday' | 'anniversary' | 'holiday';
    label: string;
    date: string;
  }>;
  headcountByDepartment: Array<{ name: string; count: number }>;
  recentJoiners: Array<{ id: string; name: string; date: string; designation: string | null }>;
}
