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
  byPriority: { priority: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byDay: { date: string; opened: number; closed: number }[];
}

export interface TicketReportRow {
  id: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  agent: string;
  category: string;
  createdAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  resolutionMinutes?: number;
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

export interface DealsByMonthRow {
  period: string;
  won: number;
  lost: number;
  wonValue: number;
  lostValue: number;
}

export interface LeadStageFunnelRow {
  stage: string;
  count: number;
  conversionFromPrev: number;
}

/* ─── Finance: FY-aware deepened report rows ─────────────────────── */

export interface IncomeReportKpis {
  totalFY: number;
  thisMonth: number;
  yoyChangePct: number;
  topSource: string;
  topSourceTotal: number;
}

export interface IncomeInvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  total: number;
  paidAmount: number;
  status: string;
  source: string;
}

export interface ExpenseReportKpis {
  totalFY: number;
  thisMonth: number;
  yoyChangePct: number;
  topCategory: string;
  topCategoryTotal: number;
}

export interface ExpenseTableRow {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  taxAmount: number;
  status: string;
  reference: string;
}

export interface ProfitLossKpis {
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  ebitda: number;
  revenue: number;
  cogs: number;
  opex: number;
}

export interface ProfitLossStackedRow {
  period: string;
  revenue: number;
  cogs: number;
  expense: number;
  profit: number;
}

export interface TaxReportKpis {
  taxCollected: number;
  taxPaid: number;
  netLiability: number;
  pendingFilings: number;
}

export interface TaxMonthlyRow {
  period: string;
  collected: number;
  paid: number;
  net: number;
}

export interface InvoiceAgingKpis {
  current: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
  openCount: number;
}

export interface InvoiceAgingClientRow {
  accountId: string;
  clientName: string;
  current: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
  openCount: number;
}

export interface InvoiceAgingDetailRow {
  id: string;
  invoiceNumber: string;
  clientName: string;
  accountId: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  outstanding: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+';
}

export interface PaymentReportKpis {
  receivedMtd: number;
  pendingReceipts: number;
  overdueAmount: number;
  avgDsoDays: number;
  monthTarget: number;
}

export interface PaymentMtdRow {
  period: string;
  received: number;
  target: number;
}

export interface PaymentMethodRow {
  method: string;
  total: number;
  count: number;
}

export interface PaymentReceiptRow {
  id: string;
  receiptNumber: string;
  date: string;
  clientName: string;
  amount: number;
  method: string;
  invoiceNumber: string;
  invoiceId: string;
}

/* ─── Top Clients / Products deepened ───────────────────────────── */

export interface TopClientDeepRow {
  clientId: string;
  clientName: string;
  industry: string;
  revenue: number;
  invoices: number;
  avgOrderValue: number;
  lastOrderDate: string;
}

export interface TopProductDeepRow {
  productName: string;
  category: string;
  units: number;
  revenue: number;
  avgPrice: number;
}

/* ─── Lead conversion by source ────────────────────────────────── */

export interface LeadsBySourceRow {
  source: string;
  total: number;
  converted: number;
  conversionRate: number;
}

/* ─── Deals filtered ────────────────────────────────────────────── */

export interface DealsFilteredRow {
  id: string;
  name: string;
  stage: string;
  value: number;
  owner: string;
  pipeline: string;
  accountId?: string;
  createdAt: string | null;
}

/* ─── P&L granularity rows ──────────────────────────────────────── */

export interface ProfitLossQuarterRow {
  period: string;
  revenue: number;
  cogs: number;
  expense: number;
  profit: number;
}
