export type LeaveKpiKey = 'pending' | 'approved' | 'rejected' | 'availableBalance' | 'usedThisMonth';

export interface LeaveKpiSnapshot {
  pending: number;
  approved: number;
  rejected: number;
  availableBalance: number | null;
  usedThisMonth: number;
}

export interface LeaveListRow {
  _id: string;
  employeeId?: string;
  employeeName?: string;
  leaveTypeId?: string;
  leaveTypeName?: string;
  status: string;
  startDate: string | Date;
  endDate: string | Date;
  days?: number;
  reason?: string;
}

export type LeavePreset = 'all' | 'mine' | 'pending' | 'this-month';
export type LeaveStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveTypeOption = { value: string; label: string };
export type LeaveViewMode = 'table' | 'calendar';
