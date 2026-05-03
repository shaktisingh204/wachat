/**
 * HRM & People Ops barrel.
 *
 * Pure-domain HR helpers: types, payroll calculators, attendance, leaves,
 * performance, learning, recruitment, onboarding, engagement, expenses,
 * and org-chart. UI/persistence layers should depend on this barrel rather
 * than on the individual files.
 */

export * from './types';

export { calculatePayrollIN } from './payroll/india';
export { calculatePayrollUS } from './payroll/us';
export { calculatePayrollUK } from './payroll/uk';
export { calculatePayrollEU } from './payroll/eu';
export { getCalculator, listSupportedCountries } from './payroll/registry';
export type { PayrollCalculator } from './payroll/registry';

export {
  haversineMeters,
  isWithinGeofence,
  assignShift,
  recordClockIn,
  recordClockOut,
  buildAttendance,
  summariseOvertime,
} from './attendance';
export type { ClockEvent, Geofence, ClockInResult, ClockOutResult } from './attendance';

export {
  accrueLeave,
  computeBalance,
  countWorkingDays,
  requestLeave,
  approveLeave,
  rejectLeave,
  STATIC_HOLIDAYS,
} from './leaves';
export type { LeaveBalance, LeaveDecision } from './leaves';

export {
  rollUpOkrProgress,
  progressFromMetric,
  classifyGoal,
  aggregate360,
  calibrate,
} from './performance';
export type { ReviewAggregate } from './performance';

export {
  assignCourse,
  recordProgress,
  issueCertification,
  findExpiringCertifications,
} from './learning';
export type { CourseAssignment, ExpiryAlert } from './learning';

export {
  DEFAULT_PIPELINE,
  pipelineStats,
  advance,
  reject as rejectCandidate,
  scoreCandidate,
  buildInterviewKit,
  draftOffer,
  nextInterviewRound,
} from './recruitment';
export type { PipelineStats, InterviewKit, OfferDraft } from './recruitment';

export {
  buildSevenDayProgram,
  toSabflowPlan,
  buildOffboardingPlan,
} from './onboarding';
export type { SevenDayOptions, SabflowExecutionPlan } from './onboarding';

export {
  classifyResponse,
  calculateEnps,
  hashRespondent,
  createAnonymousReport,
} from './engagement';
export type { EnpsResponse, AnonymousReport } from './engagement';

export {
  stubOcr,
  attachReceipt,
  calculateMileage,
  pickApprover,
  submit as submitExpense,
  approve as approveExpense,
  reject as rejectExpense,
  reimburse,
  DEFAULT_RULES,
  MILEAGE_RATE_USD_PER_MILE,
  MILEAGE_RATE_GBP_PER_MILE,
  MILEAGE_RATE_INR_PER_KM,
} from './expenses';
export type { OcrProvider, ApprovalRule } from './expenses';

export {
  buildOrgChart,
  serializeOrgChart,
  deserializeOrgChart,
  depth,
  flatten,
  findReports,
  findManagerChain,
} from './org-chart';
export type { SerializedOrgChart } from './org-chart';
