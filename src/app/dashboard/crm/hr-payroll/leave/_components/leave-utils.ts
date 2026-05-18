import type { LeaveListRow } from './types';

export interface EmployeeLite {
  _id: string;
  name: string;
  department?: string;
}

export function isInMonth(date: string | Date, month: Date): boolean {
  const d = new Date(date as string);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

export function toLeaveRow(leave: any, employees: EmployeeLite[]): LeaveListRow {
  const emp = employees.find((e) => e._id === String(leave.employeeId ?? ''));
  return {
    _id: String(leave._id),
    employeeId: String(leave.employeeId ?? ''),
    employeeName: emp?.name ?? '',
    leaveTypeId: String(leave.leaveTypeId ?? ''),
    leaveTypeName: leave.leaveTypeName ?? '',
    status: leave.status ?? 'pending',
    startDate: leave.startDate,
    endDate: leave.endDate,
    days: leave.days,
    reason: leave.reason,
  };
}

export function leaveRowsToCsv(rows: LeaveListRow[]): string {
  const headers = ['Employee', 'Type', 'Status', 'Start', 'End', 'Days', 'Reason'];
  const lines = rows.map((r) =>
    [r.employeeName, r.leaveTypeName, r.status, r.startDate, r.endDate, r.days, r.reason]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}
