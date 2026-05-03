/**
 * Leave management — accrual, balance, request lifecycle, holiday calendars.
 */

import type {
  Country,
  Employee,
  Holiday,
  LeavePolicy,
  LeaveRequest,
  LeaveType,
  ID,
} from './types';

export interface LeaveBalance {
  employeeId: ID;
  leaveType: LeaveType;
  accrued: number;
  used: number;
  pending: number;
  carriedForward: number;
  available: number;
}

/** Accrue based on cadence between two dates. */
export function accrueLeave(
  policy: LeavePolicy,
  employee: Employee,
  from: Date,
  to: Date,
): number {
  const joining = new Date(employee.dateOfJoining);
  const start = joining > from ? joining : from;
  if (start >= to) return 0;
  const months = monthsBetween(start, to);
  const monthly = policy.annualEntitlement / 12;
  switch (policy.accrualCadence) {
    case 'monthly':
      return Math.floor(months) * monthly;
    case 'quarterly':
      return Math.floor(months / 3) * (policy.annualEntitlement / 4);
    case 'annual':
      return months >= 12 ? policy.annualEntitlement : 0;
  }
}

function monthsBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

export function computeBalance(
  policy: LeavePolicy,
  employee: Employee,
  requests: LeaveRequest[],
  asOf: Date,
): LeaveBalance {
  const accrued = accrueLeave(policy, employee, new Date(employee.dateOfJoining), asOf);
  const carriedForward = Math.min(policy.carryForward, 0);
  const myReqs = requests.filter((r) => r.employeeId === employee.id && r.leaveType === policy.leaveType);
  const used = myReqs.filter((r) => r.status === 'approved').reduce((s, r) => s + r.days, 0);
  const pending = myReqs.filter((r) => r.status === 'pending').reduce((s, r) => s + r.days, 0);
  return {
    employeeId: employee.id,
    leaveType: policy.leaveType,
    accrued,
    used,
    pending,
    carriedForward,
    available: Math.max(0, accrued + carriedForward - used - pending),
  };
}

export function countWorkingDays(from: Date, to: Date, holidays: Holiday[], country: Country): number {
  if (to < from) return 0;
  const holidaySet = new Set(holidays.filter((h) => h.country === country).map((h) => h.date));
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getUTCDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(iso)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export interface LeaveDecision {
  ok: boolean;
  reason?: string;
  request: LeaveRequest;
}

export function requestLeave(
  draft: Omit<LeaveRequest, 'id' | 'status' | 'days'>,
  policy: LeavePolicy,
  employee: Employee,
  history: LeaveRequest[],
  holidays: Holiday[],
  asOf: Date,
): LeaveDecision {
  const from = new Date(draft.fromDate);
  const to = new Date(draft.toDate);
  if (to < from) {
    return {
      ok: false,
      reason: 'invalid-range',
      request: { ...draft, id: '', status: 'rejected', days: 0 },
    };
  }
  const days = countWorkingDays(from, to, holidays, employee.country) * (draft.halfDay ? 0.5 : 1);
  const balance = computeBalance(policy, employee, history, asOf);
  const request: LeaveRequest = {
    ...draft,
    id: `lr_${employee.id}_${draft.fromDate}`,
    status: 'pending',
    days,
  };
  if (days > balance.available && policy.leaveType !== 'unpaid') {
    return { ok: false, reason: 'insufficient-balance', request };
  }
  return { ok: true, request };
}

export function approveLeave(req: LeaveRequest, approverId: ID): LeaveRequest {
  return { ...req, status: 'approved', approverId, decidedAt: new Date().toISOString() };
}

export function rejectLeave(req: LeaveRequest, approverId: ID, reason?: string): LeaveRequest {
  return {
    ...req,
    status: 'rejected',
    approverId,
    decidedAt: new Date().toISOString(),
    reason: reason ?? req.reason,
  };
}

/** A small bundled holiday calendar — extend with country-specific data. */
export const STATIC_HOLIDAYS: Holiday[] = [
  { date: '2026-01-26', name: 'Republic Day', country: 'IN' },
  { date: '2026-08-15', name: 'Independence Day', country: 'IN' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', country: 'IN' },
  { date: '2026-12-25', name: 'Christmas', country: 'IN' },
  { date: '2026-01-01', name: "New Year's Day", country: 'US' },
  { date: '2026-07-04', name: 'Independence Day', country: 'US' },
  { date: '2026-11-26', name: 'Thanksgiving', country: 'US' },
  { date: '2026-12-25', name: 'Christmas', country: 'US' },
  { date: '2026-12-25', name: 'Christmas', country: 'UK' },
  { date: '2026-12-26', name: 'Boxing Day', country: 'UK' },
];
