'use server';

import { ObjectId } from 'mongodb';

import { getCachedSession } from '@/lib/server-cache';
import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  EmployeeRow,
  EmploymentType,
  EmployeeStatus,
  AttendanceStatus,
  LeaveStatus,
  PayslipStatus,
  LeaveRequestRow,
  AttendanceRow,
  PayslipRow,
} from '@/lib/sabhrm/types';

/* ── doc shapes (server-internal, mirrors the source surfaces) ───────────── */

interface EmployeeDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  reportingManagerId?: string;
  reportingManagerName?: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  dateOfJoining?: Date;
  dob?: Date;
  workLocation?: string;
  ctc?: number;
  photoUrl?: string;
  userId?: string;
}

interface LeaveRequestDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  from: Date;
  to: Date;
  days: number;
  reason?: string;
  status: LeaveStatus;
  appliedAt: Date;
}

interface AttendanceDoc {
  _id: ObjectId;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  workedHours?: number;
  note?: string;
}

interface PayslipDoc {
  _id: ObjectId;
  workspaceId: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  periodLabel: string;
  gross: number;
  deductions: number;
  net: number;
  status: PayslipStatus;
}

/* ── DTO ─────────────────────────────────────────────────────────────────── */

export interface MyHrmSpace {
  /** The current user's employee profile in this org, or null if none. */
  employee: EmployeeRow | null;
  leaveRequests: LeaveRequestRow[];
  attendance: AttendanceRow[];
  payslips: PayslipRow[];
}

/* ── row mappers ───────────────────────────────────────────────────────────── */

function isoDay(d: Date | undefined | null): string | null {
  return d instanceof Date ? d.toISOString().slice(0, 10) : null;
}

function toEmployeeRow(d: EmployeeDoc): EmployeeRow {
  return {
    id: String(d._id),
    employeeCode: d.employeeCode,
    firstName: d.firstName,
    lastName: d.lastName,
    displayName: d.displayName || `${d.firstName} ${d.lastName}`.trim(),
    email: d.email,
    phone: d.phone ?? null,
    departmentId: d.departmentId ?? null,
    departmentName: d.departmentName ?? null,
    designationId: d.designationId ?? null,
    designationName: d.designationName ?? null,
    reportingManagerId: d.reportingManagerId ?? null,
    reportingManagerName: d.reportingManagerName ?? null,
    employmentType: d.employmentType,
    status: d.status,
    dateOfJoining: isoDay(d.dateOfJoining),
    workLocation: d.workLocation ?? null,
    ctc: typeof d.ctc === 'number' ? d.ctc : null,
    photoUrl: d.photoUrl ?? null,
    userId: d.userId ?? null,
  };
}

function toLeaveRow(d: LeaveRequestDoc): LeaveRequestRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    leaveTypeId: d.leaveTypeId,
    leaveTypeName: d.leaveTypeName,
    from: d.from instanceof Date ? d.from.toISOString().slice(0, 10) : String(d.from).slice(0, 10),
    to: d.to instanceof Date ? d.to.toISOString().slice(0, 10) : String(d.to).slice(0, 10),
    days: d.days,
    reason: d.reason ?? null,
    status: d.status,
    appliedAt:
      d.appliedAt instanceof Date
        ? d.appliedAt.toISOString().slice(0, 10)
        : String(d.appliedAt).slice(0, 10),
  };
}

function toAttendanceRow(d: AttendanceDoc): AttendanceRow {
  return {
    id: String(d._id),
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    date: d.date ? d.date.toISOString().slice(0, 10) : '',
    status: d.status,
    checkIn: d.checkIn ?? null,
    checkOut: d.checkOut ?? null,
    workedHours: typeof d.workedHours === 'number' ? d.workedHours : null,
    note: d.note ?? null,
  };
}

function toPayslipRow(d: PayslipDoc): PayslipRow {
  return {
    id: String(d._id),
    payrollRunId: d.payrollRunId,
    employeeId: d.employeeId,
    employeeName: d.employeeName,
    periodLabel: d.periodLabel,
    gross: typeof d.gross === 'number' ? d.gross : 0,
    deductions: typeof d.deductions === 'number' ? d.deductions : 0,
    net: typeof d.net === 'number' ? d.net : 0,
    status: d.status,
  };
}

/* ── My space ──────────────────────────────────────────────────────────────── */

/**
 * Employee self-service: resolve the current signed-in user's employee record in
 * the active org and bundle their recent leave, attendance and payslips. All
 * reads are scoped by `workspaceId`. Returns `employee: null` when the user has
 * no employee profile in this org.
 */
export async function getMyHrmSpace(): Promise<ActionResult<MyHrmSpace>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId, userId } = g.ctx;

  try {
    const employees = db.collection<EmployeeDoc>(SABHRM_COLLECTIONS.employees);

    // Prefer the linked login user id (stored on the employee at create time),
    // fall back to matching the session email within the workspace.
    let me = await employees.findOne({ workspaceId, userId });
    if (!me) {
      const session = await getCachedSession();
      const email = (session?.user as { email?: unknown } | undefined)?.email;
      if (typeof email === 'string' && email.trim()) {
        me = await employees.findOne({ workspaceId, email: email.trim().toLowerCase() });
      }
    }

    if (!me) {
      return {
        ok: true,
        data: { employee: null, leaveRequests: [], attendance: [], payslips: [] },
      };
    }

    const employeeId = String(me._id);

    const [leaveDocs, attendanceDocs, payslipDocs] = await Promise.all([
      db
        .collection<LeaveRequestDoc>(SABHRM_COLLECTIONS.leaveRequests)
        .find({ workspaceId, employeeId })
        .sort({ appliedAt: -1, from: -1 })
        .limit(25)
        .toArray(),
      db
        .collection<AttendanceDoc>(SABHRM_COLLECTIONS.attendance)
        .find({ workspaceId, employeeId })
        .sort({ date: -1 })
        .limit(10)
        .toArray(),
      db
        .collection<PayslipDoc>(SABHRM_COLLECTIONS.payslips)
        .find({ workspaceId, employeeId })
        .sort({ createdAt: -1 })
        .limit(24)
        .toArray(),
    ]);

    return {
      ok: true,
      data: {
        employee: toEmployeeRow(me),
        leaveRequests: leaveDocs.map(toLeaveRow),
        attendance: attendanceDocs.map(toAttendanceRow),
        payslips: payslipDocs.map(toPayslipRow),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load your HR space.' };
  }
}
