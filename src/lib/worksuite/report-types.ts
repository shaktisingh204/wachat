/**
 * Worksuite Reports — shared types (extracted from reports.actions.ts
 * so the 'use server' module only exports async functions, as Next.js
 * requires).
 */

export type GroupBy = 'month' | 'year' | 'week' | 'day';

export interface PeriodRow {
  period: string; // '2026-01', '2026', '2026-W03', '2026-01-15'
  total: number;
  count: number;
}

export interface CategoryRow {
  category: string;
  total: number;
  count: number;
}

export interface ProfitLossRow {
  period: string;
  income: number;
  expense: number;
  profit: number;
}

export interface AgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  count: number;
  total: number;
}

export interface PaymentGatewayRow {
  gateway: string;
  count: number;
  total: number;
}

export interface FunnelRow {
  stage: string;
  count: number;
  value: number;
}

export interface LeadConversionStats {
  total: number;
  converted: number;
  conversionRate: number;
  avgCycleDays: number;
}

export interface TopClientRow {
  clientId: string;
  clientName: string;
  revenue: number;
  invoices: number;
}

export interface TopProductRow {
  productName: string;
  units: number;
  revenue: number;
}

export interface ProjectStatusRow {
  status: string;
  count: number;
  completion: number;
}

export interface TaskReportRow {
  bucket: string;
  count: number;
}

export interface OverdueTaskRow {
  _id: string;
  title: string;
  dueDate: string | null;
  status: string;
  priority: string;
  assignedTo?: string;
}

export interface AttendanceMatrixCell {
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | null;
}

export interface AttendanceMatrixRow {
  employeeId: string;
  employeeName: string;
  days: AttendanceMatrixCell[];
  summary: { present: number; absent: number; halfDay: number; leave: number };
}

export interface LeaveReportRow {
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  approvedDays: number;
  pendingDays: number;
  rejectedDays: number;
}

export interface LateArrivalRow {
  employeeId: string;
  employeeName: string;
  lateCount: number;
}

export interface LeaveBalanceRow {
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  allocated: number;
  used: number;
  remaining: number;
}

export interface BirthdayAnniversaryRow {
  employeeId: string;
  employeeName: string;
  kind: 'birthday' | 'anniversary';
  date: string; // next occurrence ISO date
  years?: number; // anniversary years
}

export interface TicketMetrics {
  total: number;
  open: number;
  resolved: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  byStatus: { status: string; count: number }[];
  byChannel: { channel: string; count: number }[];
  byAgent: { agent: string; count: number }[];
}

export interface AgentPerformanceRow {
  agent: string;
  total: number;
  resolved: number;
  avgResolutionMinutes: number;
}

export interface TaskReportFilters {
  status?: string;
  priority?: string;
  assigneeId?: string;
  from?: string;
  to?: string;
}
