/**
 * Pure helpers shared across the leave list — row mappers, CSV writer,
 * and date utilities. Kept module-level so the main page can lazy-import
 * them without bloating the client bundle's render path.
 */

import type {
  WsLeave,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';

import type { LeaveListRow, LeaveRowStatus } from './types';

export type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentId?: string | null;
  employeeUserId?: string;
};

export function toLeaveRow(
  l: WsLeave,
  typeMap: Map<string, WsLeaveType>,
  empMap: Map<string, EmployeeLite>,
): LeaveListRow {
  const t = typeMap.get(String(l.leave_type_id));
  const employee = l.user_id ? empMap.get(String(l.user_id)) : undefined;
  const employeeName = employee
    ? [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'Unnamed'
    : String(l.user_id ?? '—');
  const halfDay =
    l.duration === 'half-day' ||
    (l.days_count !== undefined && l.days_count % 1 !== 0);
  const status: LeaveRowStatus =
    (l.status as LeaveRowStatus) === 'cancelled'
      ? 'cancelled'
      : (l.status as LeaveRowStatus);
  const submittedAtRaw = l.applied_at ?? l.createdAt ?? null;
  return {
    _id: String(l._id),
    employeeId: l.user_id ? String(l.user_id) : null,
    employeeName,
    employeeEmail: employee?.email,
    employeeUserId: employee?.employeeUserId,
    leaveTypeId: l.leave_type_id ? String(l.leave_type_id) : null,
    leaveTypeName: t?.type_name ?? null,
    leaveTypeColor: t?.color ?? null,
    leaveTypeCode: null,
    from: l.leave_date ? new Date(l.leave_date).toISOString() : null,
    to:
      l.end_date != null
        ? new Date(l.end_date).toISOString()
        : l.leave_date
          ? new Date(l.leave_date).toISOString()
          : null,
    days: Number(l.days_count ?? 0),
    halfDay,
    reason: l.reason ?? null,
    status,
    approverId: l.approved_by ? String(l.approved_by) : null,
    approverName: null,
    submittedAt: submittedAtRaw
      ? new Date(submittedAtRaw).toISOString()
      : null,
    departmentId: employee?.departmentId ?? null,
  };
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leaveRowsToCsv(rows: LeaveListRow[]): string {
  const head = [
    'employee',
    'leaveType',
    'from',
    'to',
    'days',
    'halfDay',
    'reason',
    'status',
    'approver',
    'submittedAt',
  ];
  const body = rows.map((r) =>
    [
      csvCell(r.employeeName),
      csvCell(r.leaveTypeName ?? ''),
      csvCell(r.from ?? ''),
      csvCell(r.to ?? ''),
      csvCell(r.days),
      csvCell(r.halfDay ? 'yes' : 'no'),
      csvCell(r.reason ?? ''),
      csvCell(r.status),
      csvCell(r.approverName ?? ''),
      csvCell(r.submittedAt ?? ''),
    ].join(','),
  );
  return [head.join(','), ...body].join('\n');
}

export function isInMonth(
  iso: string | null | undefined,
  today: Date,
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth()
  );
}
