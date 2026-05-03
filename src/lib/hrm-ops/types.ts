/**
 * HRM & People Ops — domain types.
 *
 * These types model the modern HRM stack (people, time, payroll, perf,
 * learning, recruitment, engagement) and are the source of truth for the
 * other modules in `src/lib/hrm-ops/*`. They are intentionally framework
 * agnostic — strings instead of `ObjectId` — so the calculators and
 * orchestration helpers can be exercised in pure node tests.
 */

export type Country =
  | 'IN'
  | 'US'
  | 'UK'
  | 'EU'
  | 'CA'
  | 'AU'
  | 'SG'
  | 'AE'
  | 'OTHER';

export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD' | 'SGD' | 'AED';

export type ID = string;

interface Owned {
  id: ID;
  tenantId: ID;
  createdAt?: string;
  updatedAt?: string;
}

/* ── People ─────────────────────────────────────────────────────── */

export interface Employee extends Owned {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  dateOfJoining: string;
  dateOfExit?: string;
  status: 'active' | 'on-leave' | 'notice' | 'terminated' | 'retired';
  designation: string;
  departmentId?: ID;
  teamId?: ID;
  managerId?: ID;
  country: Country;
  state?: string;
  currency: Currency;
  baseSalary: number; // annual gross
  employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
  taxId?: string; // PAN/SSN/NI/etc.
  metadata?: Record<string, unknown>;
}

export interface Team extends Owned {
  name: string;
  departmentId?: ID;
  leadId?: ID;
}

export interface Department extends Owned {
  name: string;
  parentId?: ID;
  headId?: ID;
}

/* ── Leave ──────────────────────────────────────────────────────── */

export type LeaveType =
  | 'casual'
  | 'sick'
  | 'earned'
  | 'maternity'
  | 'paternity'
  | 'unpaid'
  | 'comp-off'
  | 'bereavement';

export interface LeavePolicy extends Owned {
  name: string;
  leaveType: LeaveType;
  annualEntitlement: number;
  accrualCadence: 'monthly' | 'quarterly' | 'annual';
  carryForward: number;
  encashable: boolean;
  appliesTo: { country?: Country; departmentId?: ID; employmentType?: Employee['employmentType'] };
}

export interface LeaveRequest extends Owned {
  employeeId: ID;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  halfDay?: boolean;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverId?: ID;
  decidedAt?: string;
}

export interface Holiday {
  date: string;
  name: string;
  country: Country;
  region?: string;
  optional?: boolean;
}

/* ── Time, Shift, Attendance ────────────────────────────────────── */

export interface Shift extends Owned {
  name: string;
  startTime: string; // HH:mm 24h
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  weeklyOffs: number[]; // 0=Sun..6=Sat
  timezone: string;
}

export interface Attendance extends Owned {
  employeeId: ID;
  date: string; // YYYY-MM-DD
  clockIn?: string; // ISO
  clockOut?: string;
  shiftId?: ID;
  workedMinutes: number;
  overtimeMinutes: number;
  status: 'present' | 'absent' | 'half-day' | 'leave' | 'holiday' | 'weekend';
  geo?: { lat: number; lng: number; accuracy?: number };
  notes?: string;
}

/* ── Payroll ────────────────────────────────────────────────────── */

export interface PayrollInput {
  employeeId: ID;
  period: string; // YYYY-MM
  country: Country;
  state?: string;
  grossAnnual: number;
  basicPct?: number;
  hraPct?: number;
  workedDays: number;
  totalDays: number;
  variablePay?: number;
  bonus?: number;
  oneOffDeductions?: number;
  taxRegime?: 'old' | 'new';
  filingStatus?: 'single' | 'married_jointly' | 'married_separately' | 'head_of_household';
  allowances?: number;
  pensionContribPct?: number;
  studentLoanPlan?: 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
  yearOfService?: number;
}

export interface PayslipLine {
  code: string;
  label: string;
  amount: number;
  category: 'earning' | 'deduction' | 'tax' | 'employer';
}

export interface Payslip extends Owned {
  employeeId: ID;
  period: string;
  country: Country;
  currency: Currency;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  taxes: PayslipLine[];
  employerContributions: PayslipLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  meta?: Record<string, unknown>;
}

export interface Payroll extends Owned {
  period: string;
  country: Country;
  status: 'draft' | 'processing' | 'finalized' | 'paid';
  payslipIds: ID[];
  totalGross: number;
  totalNet: number;
  runAt?: string;
}

/* ── Benefits & Expenses ────────────────────────────────────────── */

export interface Benefit extends Owned {
  name: string;
  category: 'health' | 'dental' | 'vision' | 'retirement' | 'meal' | 'commute' | 'other';
  monthlyEmployerContribution: number;
  monthlyEmployeeContribution: number;
  currency: Currency;
  enrolledEmployeeIds: ID[];
}

export interface Expense extends Owned {
  employeeId: ID;
  date: string;
  amount: number;
  currency: Currency;
  category: 'travel' | 'meals' | 'lodging' | 'mileage' | 'supplies' | 'other';
  merchant?: string;
  receiptId?: ID;
  description?: string;
  miles?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed';
  approverId?: ID;
}

export interface Receipt extends Owned {
  url: string;
  ocr?: {
    merchant?: string;
    amount?: number;
    currency?: Currency;
    date?: string;
    raw?: string;
    confidence?: number;
  };
}

/* ── Recruitment ────────────────────────────────────────────────── */

export interface JobPosting extends Owned {
  title: string;
  departmentId?: ID;
  location?: string;
  remote: boolean;
  employmentType: Employee['employmentType'];
  description: string;
  requirements?: string[];
  salaryMin?: number;
  salaryMax?: number;
  currency?: Currency;
  status: 'draft' | 'open' | 'paused' | 'closed' | 'filled';
  postedAt?: string;
  pipelineStages?: string[];
}

export interface Candidate extends Owned {
  jobId: ID;
  name: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  source: 'careers-page' | 'referral' | 'linkedin' | 'agency' | 'inbound' | 'other';
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  rating?: number;
  tags?: string[];
}

export interface Interview extends Owned {
  candidateId: ID;
  jobId: ID;
  round: number;
  panel: ID[];
  scheduledAt: string;
  durationMinutes: number;
  mode: 'phone' | 'video' | 'onsite';
  kitId?: ID;
  feedback?: { reviewerId: ID; rating: number; comments: string }[];
  outcome?: 'advance' | 'reject' | 'hold' | 'offer';
}

export interface Offer extends Owned {
  candidateId: ID;
  jobId: ID;
  ctc: number;
  currency: Currency;
  startDate: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  sentAt?: string;
  respondedAt?: string;
}

/* ── Performance ────────────────────────────────────────────────── */

export interface Goal extends Owned {
  employeeId: ID;
  title: string;
  description?: string;
  targetDate?: string;
  progress: number; // 0..100
  status: 'on-track' | 'at-risk' | 'off-track' | 'achieved' | 'missed';
}

export interface Okr extends Owned {
  employeeId?: ID;
  teamId?: ID;
  cycle: string; // 2026-Q1
  objective: string;
  keyResults: { id: ID; description: string; metric?: string; target?: number; current?: number; progress: number }[];
  status: 'draft' | 'active' | 'achieved' | 'missed' | 'archived';
}

export interface Review extends Owned {
  employeeId: ID;
  cycle: string;
  type: 'self' | 'manager' | 'peer' | 'report' | '360';
  reviewerId: ID;
  ratings: { competency: string; score: number }[]; // 1..5
  strengths?: string;
  improvements?: string;
  overallScore?: number;
  calibrationBand?: 'top' | 'high' | 'meets' | 'below';
  submittedAt?: string;
}

/* ── Learning ───────────────────────────────────────────────────── */

export interface Course extends Owned {
  title: string;
  description?: string;
  provider?: string;
  url?: string;
  durationHours?: number;
  mandatory?: boolean;
  certificateOnComplete?: boolean;
  targetRoles?: string[];
}

export interface Certification extends Owned {
  employeeId: ID;
  courseId?: ID;
  name: string;
  issuer?: string;
  issuedAt: string;
  expiresAt?: string;
  credentialId?: string;
}

/* ── Onboarding / Offboarding ───────────────────────────────────── */

export interface OnboardingStep extends Owned {
  programId: ID;
  employeeId?: ID;
  dayOffset: number; // days from joining
  title: string;
  description?: string;
  owner: 'hr' | 'manager' | 'it' | 'employee' | 'finance';
  channel?: 'email' | 'task' | 'sabflow' | 'slack' | 'meeting';
  sabflowId?: ID;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  completedAt?: string;
}

export interface OffboardingStep extends Owned {
  employeeId: ID;
  dayOffset: number; // negative = before last working day
  title: string;
  owner: 'hr' | 'manager' | 'it' | 'employee' | 'finance';
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  completedAt?: string;
}

/* ── Engagement ─────────────────────────────────────────────────── */

export interface Survey extends Owned {
  title: string;
  type: 'enps' | 'pulse' | 'engagement' | 'exit' | 'custom';
  anonymous: boolean;
  status: 'draft' | 'active' | 'closed';
  startsAt?: string;
  endsAt?: string;
  questions: { id: ID; prompt: string; type: 'rating' | 'text' | 'yes-no' | 'enps' }[];
  audienceFilter?: { departmentId?: ID; teamId?: ID; country?: Country };
}

export interface EnpsScore extends Owned {
  surveyId: ID;
  period: string;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number; // -100..100
}

/* ── Org chart ──────────────────────────────────────────────────── */

export interface OrgChartNode {
  employeeId: ID;
  name: string;
  designation: string;
  managerId?: ID;
  departmentId?: ID;
  reports: OrgChartNode[];
}
