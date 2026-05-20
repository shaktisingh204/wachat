'use server';

/**
 * Worksuite Reports — aggregation helpers.
 *
 * These helpers are pure read queries over existing collections. They
 * never write. All queries are tenant-scoped via `userId` from the
 * current session.
 *
 * Source collections used:
 *   crm_invoices, crm_expenses, crm_payments, crm_deals, crm_leads,
 *   crm_accounts, crm_products, crm_projects, crm_tasks, crm_tickets,
 *   crm_employees, crm_attendance, crm_leaves, crm_leave_types.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';
import type {
  GroupBy,
  PeriodRow,
  CategoryRow,
  ProfitLossRow,
  AgingBucket,
  PaymentGatewayRow,
  FunnelRow,
  LeadConversionStats,
  TopClientRow,
  TopProductRow,
  ProjectStatusRow,
  TaskReportRow,
  OverdueTaskRow,
  AttendanceMatrixCell,
  AttendanceMatrixRow,
  LeaveReportRow,
  LateArrivalRow,
  LeaveBalanceRow,
  BirthdayAnniversaryRow,
  TicketMetrics,
  TicketReportRow,
  AgentPerformanceRow,
  TaskReportFilters,
  DealsByMonthRow,
  LeadStageFunnelRow,
  IncomeReportKpis,
  IncomeInvoiceRow,
  ExpenseReportKpis,
  ExpenseTableRow,
  ProfitLossKpis,
  ProfitLossStackedRow,
  TaxReportKpis,
  TaxMonthlyRow,
  InvoiceAgingKpis,
  InvoiceAgingClientRow,
  InvoiceAgingDetailRow,
  PaymentReportKpis,
  PaymentMtdRow,
  PaymentMethodRow,
  PaymentReceiptRow,
  TopClientDeepRow,
  TopProductDeepRow,
  LeadsBySourceRow,
  DealsFilteredRow,
} from '@/lib/worksuite/report-types';

/* ── Helpers ─────────────────────────────────────────────────── */

function defaultRange(from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getFullYear(), 0, 1);
  return { start, end };
}

function toOid(user: { _id: string }) {
  return new ObjectId(user._id);
}

function dateGroupProjection(groupBy: GroupBy, field: string) {
  switch (groupBy) {
    case 'year':
      return { $dateToString: { format: '%Y', date: `$${field}` } };
    case 'week':
      return { $dateToString: { format: '%G-W%V', date: `$${field}` } };
    case 'day':
      return { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } };
    case 'month':
    default:
      return { $dateToString: { format: '%Y-%m', date: `$${field}` } };
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Finance
 * ══════════════════════════════════════════════════════════════ */

export async function getIncomeByPeriod(
  from?: string,
  to?: string,
  groupBy: GroupBy = 'month',
  clientId?: string,
): Promise<PeriodRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const match: Record<string, any> = {
    userId: toOid(user),
    invoiceDate: { $gte: start, $lte: end },
    status: { $in: ['Paid', 'Partially Paid'] },
  };
  if (clientId && ObjectId.isValid(clientId)) {
    match.accountId = new ObjectId(clientId);
  }

  const rows = await db.collection('crm_invoices').aggregate([
    { $match: match },
    {
      $group: {
        _id: dateGroupProjection(groupBy, 'invoiceDate'),
        total: { $sum: { $ifNull: ['$paidAmount', '$total'] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]).toArray();

  return rows.map((r: any) => ({
    period: r._id,
    total: r.total || 0,
    count: r.count || 0,
  }));
}

export async function getExpenseByPeriod(
  from?: string,
  to?: string,
  groupBy: GroupBy = 'month',
): Promise<{ byPeriod: PeriodRow[]; byCategory: CategoryRow[] }> {
  const user = await requireSession();
  if (!user) return { byPeriod: [], byCategory: [] };
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const match = {
    userId: toOid(user),
    expenseDate: { $gte: start, $lte: end },
  };

  const [periodRows, categoryRows] = await Promise.all([
    db.collection('crm_expenses').aggregate([
      { $match: match },
      {
        $group: {
          _id: dateGroupProjection(groupBy, 'expenseDate'),
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$expenseAccount', 'Uncategorized'] },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray(),
  ]);

  return {
    byPeriod: periodRows.map((r: any) => ({
      period: r._id,
      total: r.total || 0,
      count: r.count || 0,
    })),
    byCategory: categoryRows.map((r: any) => ({
      category: r._id || 'Uncategorized',
      total: r.total || 0,
      count: r.count || 0,
    })),
  };
}

export async function getProfitLoss(
  from?: string,
  to?: string,
  groupBy: GroupBy = 'month',
): Promise<ProfitLossRow[]> {
  const [income, expense] = await Promise.all([
    getIncomeByPeriod(from, to, groupBy),
    getExpenseByPeriod(from, to, groupBy),
  ]);

  const periods = new Set<string>();
  income.forEach((r) => periods.add(r.period));
  expense.byPeriod.forEach((r) => periods.add(r.period));

  const incomeMap = new Map(income.map((r) => [r.period, r.total]));
  const expenseMap = new Map(
    expense.byPeriod.map((r) => [r.period, r.total]),
  );

  return Array.from(periods)
    .sort()
    .map((period) => {
      const inc = incomeMap.get(period) || 0;
      const exp = expenseMap.get(period) || 0;
      return { period, income: inc, expense: exp, profit: inc - exp };
    });
}

export async function getTaxSummary(
  from?: string,
  to?: string,
): Promise<{ taxCollected: number; taxPaid: number; net: number }> {
  const user = await requireSession();
  if (!user) return { taxCollected: 0, taxPaid: 0, net: 0 };
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const [invRows, expRows] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          invoiceDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          total: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      {
        $match: {
          userId: toOid(user),
          expenseDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: { $ifNull: ['$amount', 0] } },
          taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
        },
      },
    ]).toArray(),
  ]);

  const invTotal = (invRows[0] as any)?.total || 0;
  const invSubtotal = (invRows[0] as any)?.subtotal || 0;
  const taxCollected = Math.max(0, invTotal - invSubtotal);
  const taxPaid = (expRows[0] as any)?.taxAmount || 0;
  return { taxCollected, taxPaid, net: taxCollected - taxPaid };
}

export async function getInvoiceAging(): Promise<AgingBucket[]> {
  const user = await requireSession();
  if (!user) {
    return (['0-30', '31-60', '61-90', '90+'] as const).map((b) => ({
      bucket: b,
      count: 0,
      total: 0,
    }));
  }
  const { db } = await connectToDatabase();
  const today = new Date();

  const invoices = await db.collection('crm_invoices').find({
    userId: toOid(user),
    status: { $in: ['Sent', 'Partially Paid', 'Overdue'] },
  }).toArray();

  const buckets: Record<AgingBucket['bucket'], AgingBucket> = {
    '0-30': { bucket: '0-30', count: 0, total: 0 },
    '31-60': { bucket: '31-60', count: 0, total: 0 },
    '61-90': { bucket: '61-90', count: 0, total: 0 },
    '90+': { bucket: '90+', count: 0, total: 0 },
  };

  for (const inv of invoices) {
    const due = (inv as any).dueDate
      ? new Date((inv as any).dueDate)
      : new Date((inv as any).invoiceDate);
    const diffDays = Math.max(
      0,
      Math.floor((today.getTime() - due.getTime()) / (86400000)),
    );
    const outstanding =
      ((inv as any).total || 0) - ((inv as any).paidAmount || 0);
    if (outstanding <= 0) continue;
    let b: AgingBucket['bucket'];
    if (diffDays <= 30) b = '0-30';
    else if (diffDays <= 60) b = '31-60';
    else if (diffDays <= 90) b = '61-90';
    else b = '90+';
    buckets[b].count += 1;
    buckets[b].total += outstanding;
  }

  return Object.values(buckets);
}

export async function getPaymentsByGateway(
  from?: string,
  to?: string,
): Promise<PaymentGatewayRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const rows = await db.collection('crm_payments').aggregate([
    {
      $match: {
        userId: toOid(user),
        paid_on: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: { $ifNull: ['$gateway', 'manual'] },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]).toArray();

  return rows.map((r: any) => ({
    gateway: r._id || 'manual',
    total: r.total || 0,
    count: r.count || 0,
  }));
}

/* ═══════════════════════════════════════════════════════════════
 *  Sales
 * ══════════════════════════════════════════════════════════════ */

export async function getDealFunnel(): Promise<FunnelRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const rows = await db.collection('crm_deals').aggregate([
    { $match: { userId: toOid(user) } },
    {
      $group: {
        _id: { $ifNull: ['$stage', 'Unknown'] },
        count: { $sum: 1 },
        value: { $sum: { $ifNull: ['$value', 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  return rows.map((r: any) => ({
    stage: r._id || 'Unknown',
    count: r.count || 0,
    value: r.value || 0,
  }));
}

export async function getLeadConversion(
  from?: string,
  to?: string,
): Promise<LeadConversionStats> {
  const user = await requireSession();
  if (!user) {
    return { total: 0, converted: 0, conversionRate: 0, avgCycleDays: 0 };
  }
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const leads = await db.collection('crm_leads').find({
    userId: toOid(user),
    createdAt: { $gte: start, $lte: end },
  }).toArray();

  const total = leads.length;
  let converted = 0;
  let cycleTotal = 0;
  let cycleCount = 0;

  for (const l of leads) {
    if ((l as any).status === 'Converted') {
      converted += 1;
      const created = (l as any).createdAt
        ? new Date((l as any).createdAt)
        : null;
      const convertedAt = (l as any).convertedAt
        ? new Date((l as any).convertedAt)
        : (l as any).updatedAt
          ? new Date((l as any).updatedAt)
          : null;
      if (created && convertedAt) {
        const days = Math.max(
          0,
          (convertedAt.getTime() - created.getTime()) / 86400000,
        );
        cycleTotal += days;
        cycleCount += 1;
      }
    }
  }

  return {
    total,
    converted,
    conversionRate: total ? (converted / total) * 100 : 0,
    avgCycleDays: cycleCount ? cycleTotal / cycleCount : 0,
  };
}

export async function getTopClients(
  limit = 10,
  from?: string,
  to?: string,
): Promise<TopClientRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const match: Record<string, unknown> = {
    userId: toOid(user),
    status: { $in: ['Paid', 'Partially Paid'] },
  };
  if (from || to) {
    const { start, end } = defaultRange(from, to);
    match.invoiceDate = { $gte: start, $lte: end };
  }

  const rows = await db.collection('crm_invoices').aggregate([
    { $match: match },
    {
      $group: {
        _id: '$accountId',
        revenue: { $sum: { $ifNull: ['$paidAmount', '$total'] } },
        invoices: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]).toArray();

  const accountIds = rows.map((r: any) => r._id).filter(Boolean);
  const accounts = accountIds.length
    ? await db.collection('crm_accounts').find({
        userId: toOid(user),
        _id: { $in: accountIds },
      }).toArray()
    : [];

  const nameById = new Map<string, string>();
  accounts.forEach((a: any) => nameById.set(a._id.toString(), a.name));

  return rows.map((r: any) => ({
    clientId: r._id ? r._id.toString() : '',
    clientName: r._id
      ? nameById.get(r._id.toString()) || '—'
      : 'No account',
    revenue: r.revenue || 0,
    invoices: r.invoices || 0,
  }));
}

export async function getTopProducts(
  limit = 10,
  from?: string,
  to?: string,
): Promise<TopProductRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const match: Record<string, unknown> = { userId: toOid(user) };
  if (from || to) {
    const { start, end } = defaultRange(from, to);
    match.invoiceDate = { $gte: start, $lte: end };
  }

  const rows = await db.collection('crm_invoices').aggregate([
    { $match: match },
    { $unwind: { path: '$lineItems', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: { $ifNull: ['$lineItems.name', 'Unnamed'] },
        units: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
        revenue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$lineItems.quantity', 0] },
              { $ifNull: ['$lineItems.rate', 0] },
            ],
          },
        },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]).toArray();

  return rows.map((r: any) => ({
    productName: r._id || 'Unnamed',
    units: r.units || 0,
    revenue: r.revenue || 0,
  }));
}

/* ═══════════════════════════════════════════════════════════════
 *  Tasks & Projects
 * ══════════════════════════════════════════════════════════════ */

export async function getProjectStatusReport(): Promise<ProjectStatusRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const rows = await db.collection('crm_projects').aggregate([
    { $match: { userId: toOid(user) } },
    {
      $group: {
        _id: { $ifNull: ['$status', 'unknown'] },
        count: { $sum: 1 },
        completion: { $avg: { $ifNull: ['$completionPercent', 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  return rows.map((r: any) => ({
    status: r._id || 'unknown',
    count: r.count || 0,
    completion: Math.round(r.completion || 0),
  }));
}

export async function getTaskReport(
  filters: TaskReportFilters = {},
): Promise<{
  byAssignee: TaskReportRow[];
  byStatus: TaskReportRow[];
  byPriority: TaskReportRow[];
  total: number;
}> {
  const user = await requireSession();
  if (!user) {
    return { byAssignee: [], byStatus: [], byPriority: [], total: 0 };
  }
  const { db } = await connectToDatabase();

  const match: Record<string, any> = { userId: toOid(user) };
  if (filters.status) match.status = filters.status;
  if (filters.priority) match.priority = filters.priority;
  if (filters.assigneeId && ObjectId.isValid(filters.assigneeId)) {
    match.assignedTo = new ObjectId(filters.assigneeId);
  }
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = new Date(filters.from);
    if (filters.to) range.$lte = new Date(filters.to);
    match.createdAt = range;
  }

  const [assignee, status, priority, total] = await Promise.all([
    db.collection('crm_tasks').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$assignedTo', 'unassigned'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('crm_tasks').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$status', 'unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('crm_tasks').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$priority', 'unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('crm_tasks').countDocuments(match),
  ]);

  // Resolve assignee ids to employee names
  const employeeIds = assignee
    .map((r: any) => r._id)
    .filter((v: any) => v && v !== 'unassigned' && ObjectId.isValid(v));
  const employees = employeeIds.length
    ? await db.collection('crm_employees').find({
        userId: toOid(user),
        _id: { $in: employeeIds.map((id: any) => new ObjectId(id)) },
      }).toArray()
    : [];
  const nameById = new Map<string, string>();
  employees.forEach((e: any) => {
    nameById.set(
      e._id.toString(),
      `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
    );
  });

  return {
    byAssignee: assignee.map((r: any) => ({
      bucket:
        r._id === 'unassigned' || !r._id
          ? 'Unassigned'
          : nameById.get(r._id.toString?.() || String(r._id)) ||
            `Employee ${String(r._id).slice(-6)}`,
      count: r.count || 0,
    })),
    byStatus: status.map((r: any) => ({
      bucket: r._id || 'unknown',
      count: r.count || 0,
    })),
    byPriority: priority.map((r: any) => ({
      bucket: r._id || 'unknown',
      count: r.count || 0,
    })),
    total,
  };
}

export async function getOverdueTasks(): Promise<OverdueTaskRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const today = new Date();

  const tasks = await db.collection('crm_tasks').find({
    userId: toOid(user),
    dueDate: { $lt: today },
    status: { $ne: 'Completed' },
  }).sort({ dueDate: 1 }).limit(200).toArray();

  // Resolve assignees
  const ids = tasks
    .map((t: any) => t.assignedTo)
    .filter((v: any) => v && ObjectId.isValid(v));
  const employees = ids.length
    ? await db.collection('crm_employees').find({
        userId: toOid(user),
        _id: { $in: ids.map((id: any) => new ObjectId(id)) },
      }).toArray()
    : [];
  const nameById = new Map<string, string>();
  employees.forEach((e: any) => {
    nameById.set(
      e._id.toString(),
      `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || '—',
    );
  });

  return tasks.map((t: any) => ({
    _id: t._id.toString(),
    title: t.title || '(untitled)',
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    status: t.status || 'To-Do',
    priority: t.priority || 'Medium',
    assignedTo: t.assignedTo
      ? nameById.get(t.assignedTo.toString()) || undefined
      : undefined,
  }));
}

/* ═══════════════════════════════════════════════════════════════
 *  HR — attendance, leaves, late, birthdays
 * ══════════════════════════════════════════════════════════════ */

export async function getAttendanceMatrix(
  month: number,   // 1-12
  year: number,
  employeeId?: string,
): Promise<AttendanceMatrixRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  const daysInMonth = end.getDate();

  const employeeMatch: Record<string, any> = {
    userId: toOid(user),
    status: 'Active',
  };
  if (employeeId && ObjectId.isValid(employeeId)) {
    employeeMatch._id = new ObjectId(employeeId);
  }
  const employees = await db.collection('crm_employees').find(employeeMatch).toArray();

  const attendances = await db.collection('crm_attendance').find({
    userId: toOid(user),
    date: { $gte: start, $lte: end },
  }).toArray();

  const byEmp = new Map<string, Map<string, string>>();
  for (const a of attendances) {
    const eid = (a as any).employeeId?.toString?.();
    if (!eid) continue;
    const d = new Date((a as any).date);
    const key = d.toISOString().slice(0, 10);
    if (!byEmp.has(eid)) byEmp.set(eid, new Map());
    byEmp.get(eid)!.set(key, (a as any).status);
  }

  return employees.map((e: any) => {
    const eid = e._id.toString();
    const records = byEmp.get(eid) || new Map();
    const days: AttendanceMatrixCell[] = [];
    const summary = { present: 0, absent: 0, halfDay: 0, leave: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = new Date(year, month - 1, d).toISOString().slice(0, 10);
      const status = (records.get(dateKey) as AttendanceMatrixCell['status']) ?? null;
      days.push({ date: dateKey, status });
      if (status === 'Present') summary.present++;
      else if (status === 'Absent') summary.absent++;
      else if (status === 'Half Day') summary.halfDay++;
      else if (status === 'Leave') summary.leave++;
    }
    return {
      employeeId: eid,
      employeeName:
        `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
      days,
      summary,
    };
  });
}

export async function getLeavesReport(
  from?: string,
  to?: string,
): Promise<LeaveReportRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const leaves = await db.collection('crm_leaves').find({
    userId: toOid(user),
    leave_date: { $gte: start, $lte: end },
  }).toArray();

  const empIds = new Set<string>();
  const typeIds = new Set<string>();
  leaves.forEach((l: any) => {
    if (l.user_id) empIds.add(l.user_id.toString());
    if (l.leave_type_id) typeIds.add(l.leave_type_id.toString());
  });

  const [employees, types] = await Promise.all([
    empIds.size
      ? db.collection('crm_employees').find({
          userId: toOid(user),
          _id: { $in: Array.from(empIds).filter(ObjectId.isValid).map((id) => new ObjectId(id)) },
        }).toArray()
      : [],
    typeIds.size
      ? db.collection('crm_leave_types').find({
          userId: toOid(user),
          _id: { $in: Array.from(typeIds).filter(ObjectId.isValid).map((id) => new ObjectId(id)) },
        }).toArray()
      : [],
  ]);

  const empName = new Map<string, string>();
  employees.forEach((e: any) => {
    empName.set(
      e._id.toString(),
      `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
    );
  });
  const typeName = new Map<string, string>();
  types.forEach((t: any) => typeName.set(t._id.toString(), t.type_name));

  type Key = string;
  const agg = new Map<
    Key,
    { employeeId: string; employeeName: string; leaveTypeName: string; approvedDays: number; pendingDays: number; rejectedDays: number }
  >();
  for (const l of leaves) {
    const eid = (l as any).user_id?.toString() || '';
    const tid = (l as any).leave_type_id?.toString() || '';
    const key = `${eid}|${tid}`;
    if (!agg.has(key)) {
      agg.set(key, {
        employeeId: eid,
        employeeName: empName.get(eid) || '—',
        leaveTypeName: typeName.get(tid) || 'Unknown',
        approvedDays: 0,
        pendingDays: 0,
        rejectedDays: 0,
      });
    }
    const row = agg.get(key)!;
    const days = (l as any).days_count || 0;
    const status = (l as any).status || 'pending';
    if (status === 'approved') row.approvedDays += days;
    else if (status === 'rejected') row.rejectedDays += days;
    else row.pendingDays += days;
  }

  return Array.from(agg.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );
}

export async function getLateArrivals(
  from?: string,
  to?: string,
  graceMinutes = 15,
  shiftStartHour = 9,
): Promise<LateArrivalRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const attendances = await db.collection('crm_attendance').find({
    userId: toOid(user),
    date: { $gte: start, $lte: end },
    checkIn: { $exists: true, $ne: null },
  }).toArray();

  const lateBy = new Map<string, number>();
  for (const a of attendances) {
    const checkIn = (a as any).checkIn ? new Date((a as any).checkIn) : null;
    if (!checkIn) continue;
    const shiftStart = new Date(checkIn);
    shiftStart.setHours(shiftStartHour, graceMinutes, 0, 0);
    if (checkIn.getTime() > shiftStart.getTime()) {
      const eid = (a as any).employeeId?.toString();
      if (!eid) continue;
      lateBy.set(eid, (lateBy.get(eid) || 0) + 1);
    }
  }

  const ids = Array.from(lateBy.keys()).filter(ObjectId.isValid);
  const employees = ids.length
    ? await db.collection('crm_employees').find({
        userId: toOid(user),
        _id: { $in: ids.map((id) => new ObjectId(id)) },
      }).toArray()
    : [];
  const nameById = new Map<string, string>();
  employees.forEach((e: any) => {
    nameById.set(
      e._id.toString(),
      `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
    );
  });

  return Array.from(lateBy.entries())
    .map(([employeeId, lateCount]) => ({
      employeeId,
      employeeName: nameById.get(employeeId) || '—',
      lateCount,
    }))
    .sort((a, b) => b.lateCount - a.lateCount);
}

export async function getLeaveBalanceReport(): Promise<LeaveBalanceRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const [employees, types, leaves] = await Promise.all([
    db.collection('crm_employees').find({
      userId: toOid(user),
      status: 'Active',
    }).toArray(),
    db.collection('crm_leave_types').find({
      userId: toOid(user),
    }).toArray(),
    db.collection('crm_leaves').find({
      userId: toOid(user),
      status: 'approved',
    }).toArray(),
  ]);

  const usedByKey = new Map<string, number>();
  for (const l of leaves) {
    const eid = (l as any).user_id?.toString() || '';
    const tid = (l as any).leave_type_id?.toString() || '';
    if (!eid || !tid) continue;
    const key = `${eid}|${tid}`;
    usedByKey.set(key, (usedByKey.get(key) || 0) + ((l as any).days_count || 0));
  }

  const rows: LeaveBalanceRow[] = [];
  for (const e of employees) {
    const employeeId = (e as any)._id.toString();
    const employeeName =
      `${(e as any).firstName || ''} ${(e as any).lastName || ''}`.trim() ||
      (e as any).email ||
      'Unknown';
    for (const t of types) {
      const tid = (t as any)._id.toString();
      const allocated = (t as any).no_of_leaves || 0;
      const used = usedByKey.get(`${employeeId}|${tid}`) || 0;
      rows.push({
        employeeId,
        employeeName,
        leaveTypeName: (t as any).type_name,
        allocated,
        used,
        remaining: Math.max(0, allocated - used),
      });
    }
  }

  return rows;
}

export async function getUpcomingBirthdays(
  days = 30,
): Promise<BirthdayAnniversaryRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const employees = await db.collection('crm_employees').find({
    userId: toOid(user),
    status: 'Active',
  }).toArray();

  const today = new Date();
  const windowMs = days * 86400000;
  const rows: BirthdayAnniversaryRow[] = [];

  for (const e of employees) {
    const emp = e as any;
    const employeeId = emp._id.toString();
    const employeeName =
      `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
      emp.email ||
      'Unknown';

    function nextOccurrence(src: Date): Date {
      const d = new Date(
        today.getFullYear(),
        src.getMonth(),
        src.getDate(),
      );
      if (d.getTime() < today.getTime() - 86400000) {
        d.setFullYear(today.getFullYear() + 1);
      }
      return d;
    }

    if (emp.dateOfBirth) {
      const next = nextOccurrence(new Date(emp.dateOfBirth));
      if (next.getTime() - today.getTime() <= windowMs) {
        rows.push({
          employeeId,
          employeeName,
          kind: 'birthday',
          date: next.toISOString(),
        });
      }
    }
    if (emp.dateOfJoining) {
      const joined = new Date(emp.dateOfJoining);
      const next = nextOccurrence(joined);
      if (next.getTime() - today.getTime() <= windowMs) {
        const years = next.getFullYear() - joined.getFullYear();
        if (years >= 1) {
          rows.push({
            employeeId,
            employeeName,
            kind: 'anniversary',
            date: next.toISOString(),
            years,
          });
        }
      }
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/* ═══════════════════════════════════════════════════════════════
 *  Support — tickets & agent performance
 * ══════════════════════════════════════════════════════════════ */

export async function getTicketMetrics(
  from?: string,
  to?: string,
  filters?: { priority?: string; channel?: string; status?: string },
): Promise<TicketMetrics> {
  const user = await requireSession();
  if (!user) {
    return {
      total: 0,
      open: 0,
      resolved: 0,
      avgFirstResponseMinutes: 0,
      avgResolutionMinutes: 0,
      byStatus: [],
      byChannel: [],
      byAgent: [],
      byPriority: [],
      byCategory: [],
      byDay: [],
    };
  }
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const match: Record<string, unknown> = {
    userId: toOid(user),
    createdAt: { $gte: start, $lte: end },
  };
  if (filters?.priority) match.priority = filters.priority;
  if (filters?.channel) match.channel = filters.channel;
  if (filters?.status) match.status = filters.status;

  const tickets = await db.collection('crm_tickets').find(match).toArray();

  let open = 0;
  let resolved = 0;
  let frSum = 0;
  let frCount = 0;
  let resSum = 0;
  let resCount = 0;
  const byStatus = new Map<string, number>();
  const byChannel = new Map<string, number>();
  const byAgent = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const dayOpened = new Map<string, number>();
  const dayClosed = new Map<string, number>();

  const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

  for (const t of tickets) {
    const tk = t as Record<string, unknown> & {
      status?: string;
      channel?: string;
      assigneeName?: string;
      priority?: string;
      category?: string;
      createdAt?: Date | string;
      firstResponseAt?: Date | string;
      resolvedAt?: Date | string;
    };
    const status = tk.status || 'open';
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
    const isClosed = ['resolved', 'closed'].includes(status);
    if (isClosed) resolved++;
    else open++;

    byChannel.set(
      tk.channel || 'other',
      (byChannel.get(tk.channel || 'other') || 0) + 1,
    );
    byAgent.set(
      tk.assigneeName || 'Unassigned',
      (byAgent.get(tk.assigneeName || 'Unassigned') || 0) + 1,
    );
    const pr = (tk.priority || 'medium').toString();
    byPriority.set(pr, (byPriority.get(pr) || 0) + 1);
    const cat = (tk.category || 'uncategorised').toString();
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);

    if (tk.createdAt) {
      const k = fmtDay(new Date(tk.createdAt));
      dayOpened.set(k, (dayOpened.get(k) || 0) + 1);
    }
    if (tk.resolvedAt) {
      const k = fmtDay(new Date(tk.resolvedAt));
      dayClosed.set(k, (dayClosed.get(k) || 0) + 1);
    }

    if (tk.createdAt && tk.firstResponseAt) {
      const minutes =
        (new Date(tk.firstResponseAt).getTime() -
          new Date(tk.createdAt).getTime()) / 60000;
      if (minutes >= 0) {
        frSum += minutes;
        frCount++;
      }
    }
    if (tk.createdAt && tk.resolvedAt) {
      const minutes =
        (new Date(tk.resolvedAt).getTime() -
          new Date(tk.createdAt).getTime()) / 60000;
      if (minutes >= 0) {
        resSum += minutes;
        resCount++;
      }
    }
  }

  const allDays = new Set<string>([...dayOpened.keys(), ...dayClosed.keys()]);
  const byDay = Array.from(allDays)
    .sort()
    .map((date) => ({
      date,
      opened: dayOpened.get(date) || 0,
      closed: dayClosed.get(date) || 0,
    }));

  return {
    total: tickets.length,
    open,
    resolved,
    avgFirstResponseMinutes: frCount ? Math.round(frSum / frCount) : 0,
    avgResolutionMinutes: resCount ? Math.round(resSum / resCount) : 0,
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({
      status,
      count,
    })),
    byChannel: Array.from(byChannel.entries()).map(([channel, count]) => ({
      channel,
      count,
    })),
    byAgent: Array.from(byAgent.entries())
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count),
    byPriority: Array.from(byPriority.entries())
      .map(([priority, count]) => ({ priority, count }))
      .sort((a, b) => b.count - a.count),
    byCategory: Array.from(byCategory.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    byDay,
  };
}

/**
 * Tenant-scoped, paged ticket list for the report table. Returns
 * camelCase rows with the SLA durations pre-computed. Filters mirror
 * `getTicketMetrics` so the toolbar's selections apply consistently.
 */
export async function listTicketReportRows(
  from?: string,
  to?: string,
  filters?: { priority?: string; channel?: string; status?: string },
  page: number = 1,
  limit: number = 20,
): Promise<{ rows: TicketReportRow[]; total: number }> {
  const user = await requireSession();
  if (!user) return { rows: [], total: 0 };
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);
  const match: Record<string, unknown> = {
    userId: toOid(user),
    createdAt: { $gte: start, $lte: end },
  };
  if (filters?.priority) match.priority = filters.priority;
  if (filters?.channel) match.channel = filters.channel;
  if (filters?.status) match.status = filters.status;

  const safeLimit = Math.min(Math.max(1, limit), 200);
  const skip = Math.max(0, (page - 1) * safeLimit);

  const [docs, total] = await Promise.all([
    db
      .collection('crm_tickets')
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    db.collection('crm_tickets').countDocuments(match),
  ]);

  const rows: TicketReportRow[] = docs.map((raw) => {
    const t = raw as Record<string, unknown> & {
      _id: { toString(): string };
      subject?: string;
      status?: string;
      priority?: string;
      channel?: string;
      assigneeName?: string;
      category?: string;
      createdAt?: Date | string;
      firstResponseAt?: Date | string;
      resolvedAt?: Date | string;
    };
    const createdAt = t.createdAt ? new Date(t.createdAt) : new Date();
    const resolvedAt = t.resolvedAt ? new Date(t.resolvedAt) : undefined;
    const firstResponseAt = t.firstResponseAt
      ? new Date(t.firstResponseAt)
      : undefined;
    const resolutionMinutes = resolvedAt
      ? Math.max(0, Math.round((resolvedAt.getTime() - createdAt.getTime()) / 60000))
      : undefined;
    return {
      id: String(t._id),
      subject: t.subject || '(no subject)',
      status: t.status || 'open',
      priority: t.priority || 'medium',
      channel: t.channel || 'other',
      agent: t.assigneeName || 'Unassigned',
      category: t.category || 'uncategorised',
      createdAt: createdAt.toISOString(),
      firstResponseAt: firstResponseAt?.toISOString(),
      resolvedAt: resolvedAt?.toISOString(),
      resolutionMinutes,
    };
  });

  return { rows, total };
}

export async function getAgentPerformance(
  from?: string,
  to?: string,
): Promise<AgentPerformanceRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const tickets = await db.collection('crm_tickets').find({
    userId: toOid(user),
    createdAt: { $gte: start, $lte: end },
  }).toArray();

  const agg = new Map<
    string,
    { total: number; resolved: number; resSum: number; resCount: number }
  >();

  for (const t of tickets) {
    const tk = t as any;
    const agent = tk.assigneeName || 'Unassigned';
    if (!agg.has(agent)) {
      agg.set(agent, { total: 0, resolved: 0, resSum: 0, resCount: 0 });
    }
    const row = agg.get(agent)!;
    row.total++;
    if (['resolved', 'closed'].includes(tk.status || '')) {
      row.resolved++;
      if (tk.resolvedAt && tk.createdAt) {
        const m =
          (new Date(tk.resolvedAt).getTime() -
            new Date(tk.createdAt).getTime()) / 60000;
        if (m >= 0) {
          row.resSum += m;
          row.resCount++;
        }
      }
    }
  }

  return Array.from(agg.entries())
    .map(([agent, r]) => ({
      agent,
      total: r.total,
      resolved: r.resolved,
      avgResolutionMinutes: r.resCount ? Math.round(r.resSum / r.resCount) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getDealsByMonth(
  from?: string,
  to?: string,
): Promise<DealsByMonthRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const rows = await db.collection('crm_deals').aggregate([
    {
      $match: {
        userId: toOid(user),
        $or: [
          { closedAt: { $gte: start, $lte: end } },
          { updatedAt: { $gte: start, $lte: end } },
        ],
      },
    },
    {
      $group: {
        _id: {
          period: {
            $dateToString: {
              format: '%Y-%m',
              date: { $ifNull: ['$closedAt', '$updatedAt'] },
            },
          },
          stage: { $ifNull: ['$stage', 'Unknown'] },
        },
        count: { $sum: 1 },
        value: { $sum: { $ifNull: ['$value', 0] } },
      },
    },
  ]).toArray();

  const byPeriod = new Map<string, DealsByMonthRow>();
  for (const r of rows as Array<{ _id: { period: string; stage: string }; count: number; value: number }>) {
    const p = r._id.period || 'Unknown';
    const stage = String(r._id.stage || '').toLowerCase();
    if (!byPeriod.has(p)) {
      byPeriod.set(p, { period: p, won: 0, lost: 0, wonValue: 0, lostValue: 0 });
    }
    const row = byPeriod.get(p)!;
    if (stage === 'won' || stage === 'closed won' || stage === 'closed-won') {
      row.won += r.count;
      row.wonValue += r.value;
    } else if (stage === 'lost' || stage === 'closed lost' || stage === 'closed-lost') {
      row.lost += r.count;
      row.lostValue += r.value;
    }
  }
  return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export async function getLeadStageFunnel(
  from?: string,
  to?: string,
): Promise<LeadStageFunnelRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'];

  const rows = await db.collection('crm_leads').aggregate([
    {
      $match: {
        userId: toOid(user),
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: { $ifNull: ['$status', 'New'] },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  const countByStage = new Map<string, number>();
  for (const r of rows as Array<{ _id: string; count: number }>) {
    countByStage.set(r._id || 'New', r.count);
  }

  const ordered: LeadStageFunnelRow[] = [];
  let prev = 0;
  for (const stage of STAGE_ORDER) {
    const count = countByStage.get(stage) || 0;
    const conversionFromPrev = prev > 0 ? (count / prev) * 100 : 0;
    ordered.push({ stage, count, conversionFromPrev });
    if (count > 0) prev = count;
  }
  return ordered.filter((r) => r.count > 0 || ['Qualified', 'Converted'].includes(r.stage));
}

/* ═══════════════════════════════════════════════════════════════
 *  Finance — FY-aware deepened helpers (Batch 7)
 * ══════════════════════════════════════════════════════════════ */

/** Default Indian fiscal year: 1-Apr → 31-Mar. */
function fyRangeFromAnchor(anchorIso?: string): { start: Date; end: Date; label: string } {
  const anchor = anchorIso ? new Date(anchorIso) : new Date();
  const y = anchor.getFullYear();
  const startYear = anchor.getMonth() < 3 ? y - 1 : y;
  const start = new Date(startYear, 3, 1, 0, 0, 0);
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59);
  return { start, end, label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}` };
}

function monthIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ─── Income deep ────────────────────────────────────────────── */

export async function getIncomeReportDeep(
  fyAnchor?: string,
): Promise<{
  kpis: IncomeReportKpis;
  monthly: PeriodRow[];
  bySource: CategoryRow[];
  rows: IncomeInvoiceRow[];
  fyLabel: string;
}> {
  const empty = {
    kpis: { totalFY: 0, thisMonth: 0, yoyChangePct: 0, topSource: '—', topSourceTotal: 0 },
    monthly: [] as PeriodRow[],
    bySource: [] as CategoryRow[],
    rows: [] as IncomeInvoiceRow[],
    fyLabel: '',
  };
  const user = await requireSession();
  if (!user) return empty;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);
  const prevFy = fyRangeFromAnchor(new Date(fy.start.getFullYear() - 1, 3, 15).toISOString());

  const match = {
    userId: toOid(user),
    invoiceDate: { $gte: fy.start, $lte: fy.end },
    status: { $in: ['Paid', 'Partially Paid'] },
  };
  const prevMatch = {
    userId: toOid(user),
    invoiceDate: { $gte: prevFy.start, $lte: prevFy.end },
    status: { $in: ['Paid', 'Partially Paid'] },
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [monthly, bySource, totals, prevTotals, monthTotals, invoices] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
          total: { $sum: { $ifNull: ['$paidAmount', '$total'] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$source', { $ifNull: ['$leadSource', 'Direct'] }] },
          total: { $sum: { $ifNull: ['$paidAmount', '$total'] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$paidAmount', '$total'] } } } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$paidAmount', '$total'] } } } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          invoiceDate: { $gte: monthStart, $lte: monthEnd },
          status: { $in: ['Paid', 'Partially Paid'] },
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$paidAmount', '$total'] } } } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'crm_accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'acct',
        },
      },
      { $sort: { invoiceDate: -1 } },
      { $limit: 500 },
    ]).toArray(),
  ]);

  const fyTotal = (totals[0] as any)?.total || 0;
  const prevTotal = (prevTotals[0] as any)?.total || 0;
  const monthTotal = (monthTotals[0] as any)?.total || 0;
  const top = bySource[0] as any;

  const rows: IncomeInvoiceRow[] = invoices.map((inv: any) => ({
    id: String(inv._id),
    invoiceNumber: inv.invoiceNumber || '—',
    invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
    clientName: inv.acct?.[0]?.name || inv.clientName || 'Unknown',
    total: Number(inv.total || 0),
    paidAmount: Number(inv.paidAmount || 0),
    status: String(inv.status || ''),
    source: String(inv.source || inv.leadSource || 'Direct'),
  }));

  return {
    kpis: {
      totalFY: fyTotal,
      thisMonth: monthTotal,
      yoyChangePct: prevTotal > 0 ? ((fyTotal - prevTotal) / prevTotal) * 100 : 0,
      topSource: String(top?._id || '—'),
      topSourceTotal: Number(top?.total || 0),
    },
    monthly: (monthly as any[]).map((r) => ({ period: r._id, total: r.total || 0, count: r.count || 0 })),
    bySource: (bySource as any[]).map((r) => ({
      category: String(r._id || 'Direct'),
      total: r.total || 0,
      count: r.count || 0,
    })),
    rows,
    fyLabel: fy.label,
  };
}

/* ─── Expense deep ────────────────────────────────────────────── */

export async function getExpenseReportDeep(
  fyAnchor?: string,
): Promise<{
  kpis: ExpenseReportKpis;
  monthly: PeriodRow[];
  byCategory: CategoryRow[];
  rows: ExpenseTableRow[];
  fyLabel: string;
}> {
  const empty = {
    kpis: { totalFY: 0, thisMonth: 0, yoyChangePct: 0, topCategory: '—', topCategoryTotal: 0 },
    monthly: [] as PeriodRow[],
    byCategory: [] as CategoryRow[],
    rows: [] as ExpenseTableRow[],
    fyLabel: '',
  };
  const user = await requireSession();
  if (!user) return empty;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);
  const prevFy = fyRangeFromAnchor(new Date(fy.start.getFullYear() - 1, 3, 15).toISOString());

  const match = { userId: toOid(user), expenseDate: { $gte: fy.start, $lte: fy.end } };
  const prevMatch = { userId: toOid(user), expenseDate: { $gte: prevFy.start, $lte: prevFy.end } };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [monthly, byCategory, totals, prevTotals, monthTotals, expenses] = await Promise.all([
    db.collection('crm_expenses').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$expenseAccount', 'Uncategorized'] },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: { userId: toOid(user), expenseDate: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
    db.collection('crm_expenses')
      .find(match)
      .sort({ expenseDate: -1 })
      .limit(500)
      .toArray(),
  ]);

  const fyTotal = (totals[0] as any)?.total || 0;
  const prevTotal = (prevTotals[0] as any)?.total || 0;
  const monthTotal = (monthTotals[0] as any)?.total || 0;
  const top = byCategory[0] as any;

  const rows: ExpenseTableRow[] = expenses.map((exp: any) => ({
    id: String(exp._id),
    date: exp.expenseDate ? new Date(exp.expenseDate).toISOString().slice(0, 10) : '',
    category: String(exp.expenseAccount || 'Uncategorized'),
    description: String(exp.description || exp.notes || ''),
    amount: Number(exp.amount || 0),
    taxAmount: Number(exp.taxAmount || 0),
    status: String(exp.status || 'Recorded'),
    reference: String(exp.referenceNumber || ''),
  }));

  return {
    kpis: {
      totalFY: fyTotal,
      thisMonth: monthTotal,
      yoyChangePct: prevTotal > 0 ? ((fyTotal - prevTotal) / prevTotal) * 100 : 0,
      topCategory: String(top?._id || '—'),
      topCategoryTotal: Number(top?.total || 0),
    },
    monthly: (monthly as any[]).map((r) => ({ period: r._id, total: r.total || 0, count: r.count || 0 })),
    byCategory: (byCategory as any[]).map((r) => ({
      category: String(r._id || 'Uncategorized'),
      total: r.total || 0,
      count: r.count || 0,
    })),
    rows,
    fyLabel: fy.label,
  };
}

/* ─── Profit & Loss deep ─────────────────────────────────────── */

export async function getProfitLossDeep(
  fyAnchor?: string,
): Promise<{
  kpis: ProfitLossKpis;
  monthly: ProfitLossStackedRow[];
  fyLabel: string;
}> {
  const empty = {
    kpis: { grossProfit: 0, netProfit: 0, marginPct: 0, ebitda: 0, revenue: 0, cogs: 0, opex: 0 },
    monthly: [] as ProfitLossStackedRow[],
    fyLabel: '',
  };
  const user = await requireSession();
  if (!user) return empty;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);

  // COGS classification: expenses whose expenseAccount contains "cost" or "cogs" (heuristic),
  // everything else counts as OpEx. Tolerates missing field.
  const COGS_REGEX = /cogs|cost of (goods|sales)|purchase/i;

  const [incomeRows, expenseDocs] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          invoiceDate: { $gte: fy.start, $lte: fy.end },
          status: { $in: ['Paid', 'Partially Paid'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
          revenue: { $sum: { $ifNull: ['$paidAmount', '$total'] } },
        },
      },
    ]).toArray(),
    db.collection('crm_expenses')
      .find({ userId: toOid(user), expenseDate: { $gte: fy.start, $lte: fy.end } })
      .project({ expenseAccount: 1, amount: 1, expenseDate: 1 })
      .toArray(),
  ]);

  const byPeriod = new Map<string, ProfitLossStackedRow>();
  for (const r of incomeRows as Array<{ _id: string; revenue: number }>) {
    byPeriod.set(r._id, { period: r._id, revenue: r.revenue || 0, cogs: 0, expense: 0, profit: 0 });
  }
  let revenue = 0;
  let cogs = 0;
  let opex = 0;
  for (const r of byPeriod.values()) revenue += r.revenue;

  for (const exp of expenseDocs as any[]) {
    const key = monthIso(new Date(exp.expenseDate));
    const isCogs = COGS_REGEX.test(String(exp.expenseAccount || ''));
    const amt = Number(exp.amount || 0);
    let row = byPeriod.get(key);
    if (!row) {
      row = { period: key, revenue: 0, cogs: 0, expense: 0, profit: 0 };
      byPeriod.set(key, row);
    }
    if (isCogs) {
      row.cogs += amt;
      cogs += amt;
    } else {
      row.expense += amt;
      opex += amt;
    }
  }

  const monthly = Array.from(byPeriod.values())
    .map((r) => ({ ...r, profit: r.revenue - r.cogs - r.expense }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;

  return {
    kpis: {
      revenue,
      cogs,
      opex,
      grossProfit,
      netProfit,
      marginPct: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      // EBITDA proxy: net profit + estimated D&A (10% of opex is a rough placeholder).
      ebitda: netProfit + opex * 0.1,
    },
    monthly,
    fyLabel: fy.label,
  };
}

/* ─── Tax deep ────────────────────────────────────────────────── */

export async function getTaxReportDeep(
  fyAnchor?: string,
): Promise<{
  kpis: TaxReportKpis;
  monthly: TaxMonthlyRow[];
  fyLabel: string;
}> {
  const empty = {
    kpis: { taxCollected: 0, taxPaid: 0, netLiability: 0, pendingFilings: 0 },
    monthly: [] as TaxMonthlyRow[],
    fyLabel: '',
  };
  const user = await requireSession();
  if (!user) return empty;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);

  const [invRows, expRows, pendingFilings] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          invoiceDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          total: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      {
        $match: {
          userId: toOid(user),
          expenseDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } },
          taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
        },
      },
    ]).toArray(),
    db.collection('crm_tax_filings').countDocuments({
      userId: toOid(user),
      status: { $in: ['Pending', 'Draft', 'pending', 'draft'] },
    }).catch(() => 0),
  ]);

  const byPeriod = new Map<string, TaxMonthlyRow>();
  for (const r of invRows as Array<{ _id: string; subtotal: number; total: number }>) {
    const collected = Math.max(0, (r.total || 0) - (r.subtotal || 0));
    byPeriod.set(r._id, { period: r._id, collected, paid: 0, net: collected });
  }
  for (const r of expRows as Array<{ _id: string; taxAmount: number }>) {
    const row = byPeriod.get(r._id) || { period: r._id, collected: 0, paid: 0, net: 0 };
    row.paid = r.taxAmount || 0;
    row.net = row.collected - row.paid;
    byPeriod.set(r._id, row);
  }
  const monthly = Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
  const taxCollected = monthly.reduce((s, r) => s + r.collected, 0);
  const taxPaid = monthly.reduce((s, r) => s + r.paid, 0);

  return {
    kpis: {
      taxCollected,
      taxPaid,
      netLiability: taxCollected - taxPaid,
      pendingFilings: pendingFilings || 0,
    },
    monthly,
    fyLabel: fy.label,
  };
}

/* ─── Invoice Aging deep ─────────────────────────────────────── */

export async function getInvoiceAgingDeep(): Promise<{
  kpis: InvoiceAgingKpis;
  byClient: InvoiceAgingClientRow[];
  rows: InvoiceAgingDetailRow[];
}> {
  const empty = {
    kpis: { current: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0, openCount: 0 },
    byClient: [] as InvoiceAgingClientRow[],
    rows: [] as InvoiceAgingDetailRow[],
  };
  const user = await requireSession();
  if (!user) return empty;
  const { db } = await connectToDatabase();
  const today = new Date();

  const invoices = await db.collection('crm_invoices').aggregate([
    {
      $match: {
        userId: toOid(user),
        status: { $in: ['Sent', 'Partially Paid', 'Overdue'] },
      },
    },
    {
      $lookup: {
        from: 'crm_accounts',
        localField: 'accountId',
        foreignField: '_id',
        as: 'acct',
      },
    },
    { $limit: 1000 },
  ]).toArray();

  const kpis: InvoiceAgingKpis = { current: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0, openCount: 0 };
  const byClientMap = new Map<string, InvoiceAgingClientRow>();
  const rows: InvoiceAgingDetailRow[] = [];

  for (const inv of invoices as any[]) {
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate);
    const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
    const outstanding = Number(inv.total || 0) - Number(inv.paidAmount || 0);
    if (outstanding <= 0) continue;

    let bucket: InvoiceAgingDetailRow['bucket'];
    if (diffDays <= 30) {
      bucket = '0-30';
      kpis.current += outstanding;
    } else if (diffDays <= 60) {
      bucket = '31-60';
      kpis.d31to60 += outstanding;
    } else if (diffDays <= 90) {
      bucket = '61-90';
      kpis.d61to90 += outstanding;
    } else {
      bucket = '90+';
      kpis.over90 += outstanding;
    }
    kpis.total += outstanding;
    kpis.openCount += 1;

    const accountId = String(inv.accountId || '');
    const clientName = inv.acct?.[0]?.name || inv.clientName || 'Unknown';
    let cr = byClientMap.get(accountId);
    if (!cr) {
      cr = { accountId, clientName, current: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0, openCount: 0 };
      byClientMap.set(accountId, cr);
    }
    cr.openCount += 1;
    cr.total += outstanding;
    if (bucket === '0-30') cr.current += outstanding;
    else if (bucket === '31-60') cr.d31to60 += outstanding;
    else if (bucket === '61-90') cr.d61to90 += outstanding;
    else cr.over90 += outstanding;

    rows.push({
      id: String(inv._id),
      invoiceNumber: String(inv.invoiceNumber || '—'),
      clientName,
      accountId,
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
      daysOverdue: Math.max(0, diffDays),
      outstanding,
      bucket,
    });
  }

  const byClient = Array.from(byClientMap.values()).sort((a, b) => b.total - a.total);
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { kpis, byClient, rows };
}

/* ─── Top Clients deep ───────────────────────────────────────── */

export async function getTopClientsDeep(
  limit = 100,
  from?: string,
  to?: string,
  minRevenue = 0,
  industry?: string,
): Promise<TopClientDeepRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const invoiceMatch: Record<string, unknown> = {
    userId: toOid(user),
    status: { $in: ['Paid', 'Partially Paid'] },
  };
  if (from || to) {
    const { start, end } = defaultRange(from, to);
    invoiceMatch.invoiceDate = { $gte: start, $lte: end };
  }

  const rows = await db.collection('crm_invoices').aggregate([
    { $match: invoiceMatch },
    {
      $group: {
        _id: '$accountId',
        revenue: { $sum: { $ifNull: ['$paidAmount', '$total'] } },
        invoices: { $sum: 1 },
        lastOrderDate: { $max: '$invoiceDate' },
      },
    },
    { $match: { revenue: { $gte: minRevenue } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]).toArray();

  const accountIds = (rows as Array<{ _id: unknown }>)
    .map((r) => r._id)
    .filter(Boolean);

  const accountMatch: Record<string, unknown> = {
    userId: toOid(user),
    _id: { $in: accountIds },
  };
  if (industry) accountMatch.industry = industry;

  const accounts = accountIds.length
    ? await db.collection('crm_accounts').find(accountMatch).toArray()
    : [];

  const accountMap = new Map<string, { name: string; industry: string }>();
  for (const a of accounts as Array<{ _id: { toString(): string }; name?: string; industry?: string }>) {
    accountMap.set(a._id.toString(), {
      name: a.name || '—',
      industry: a.industry || '—',
    });
  }

  const result: TopClientDeepRow[] = [];
  for (const r of rows as Array<{
    _id: unknown;
    revenue: number;
    invoices: number;
    lastOrderDate: Date | null;
  }>) {
    const id = r._id ? String(r._id) : '';
    const acct = id ? accountMap.get(id) : undefined;
    // If an industry filter is set, skip rows whose account wasn't in the filtered result
    if (industry && id && !accountMap.has(id)) continue;
    result.push({
      clientId: id,
      clientName: acct?.name || '—',
      industry: acct?.industry || '—',
      revenue: r.revenue || 0,
      invoices: r.invoices || 0,
      avgOrderValue: r.invoices > 0 ? (r.revenue || 0) / r.invoices : 0,
      lastOrderDate: r.lastOrderDate
        ? new Date(r.lastOrderDate).toISOString().slice(0, 10)
        : '',
    });
  }

  return result;
}

/* ─── Top Products deep ──────────────────────────────────────── */

export async function getTopProductsDeep(
  limit = 100,
  from?: string,
  to?: string,
  category?: string,
  minQuantity = 0,
): Promise<TopProductDeepRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const match: Record<string, unknown> = { userId: toOid(user) };
  if (from || to) {
    const { start, end } = defaultRange(from, to);
    match.invoiceDate = { $gte: start, $lte: end };
  }

  const rows = await db.collection('crm_invoices').aggregate([
    { $match: match },
    { $unwind: { path: '$lineItems', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: { $ifNull: ['$lineItems.name', 'Unnamed'] },
        category: { $first: { $ifNull: ['$lineItems.category', '—'] } },
        units: { $sum: { $ifNull: ['$lineItems.quantity', 0] } },
        revenue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$lineItems.quantity', 0] },
              { $ifNull: ['$lineItems.rate', 0] },
            ],
          },
        },
      },
    },
    { $match: { units: { $gte: minQuantity } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]).toArray();

  return (rows as Array<{
    _id: string;
    category: string;
    units: number;
    revenue: number;
  }>)
    .filter((r) => !category || r.category === category)
    .map((r) => ({
      productName: r._id || 'Unnamed',
      category: r.category || '—',
      units: r.units || 0,
      revenue: r.revenue || 0,
      avgPrice: r.units > 0 ? (r.revenue || 0) / r.units : 0,
    }));
}

/* ─── Leads by source ────────────────────────────────────────── */

export async function getLeadsBySource(
  from?: string,
  to?: string,
  owner?: string,
): Promise<LeadsBySourceRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const match: Record<string, unknown> = {
    userId: toOid(user),
    createdAt: { $gte: start, $lte: end },
  };
  if (owner) match.assignedTo = owner;

  const rows = await db.collection('crm_leads').aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ['$source', 'Direct'] },
        total: { $sum: 1 },
        converted: {
          $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] },
        },
      },
    },
    { $sort: { total: -1 } },
  ]).toArray();

  return (rows as Array<{ _id: string; total: number; converted: number }>).map((r) => ({
    source: r._id || 'Direct',
    total: r.total || 0,
    converted: r.converted || 0,
    conversionRate: r.total > 0 ? (r.converted / r.total) * 100 : 0,
  }));
}

/* ─── Deals filtered ─────────────────────────────────────────── */

export async function getCrmDealsFiltered(
  page = 1,
  limit = 20,
  from?: string,
  to?: string,
  stage?: string,
  pipeline?: string,
): Promise<{ rows: DealsFilteredRow[]; total: number }> {
  const user = await requireSession();
  if (!user) return { rows: [], total: 0 };
  const { db } = await connectToDatabase();

  const match: Record<string, unknown> = { userId: toOid(user) };
  if (from || to) {
    const { start, end } = defaultRange(from, to);
    match.createdAt = { $gte: start, $lte: end };
  }
  if (stage) match.stage = stage;
  if (pipeline) match.pipeline = pipeline;

  const safeLimit = Math.min(Math.max(1, limit), 200);
  const skip = Math.max(0, (page - 1) * safeLimit);

  const [docs, total] = await Promise.all([
    db.collection('crm_deals').find(match).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).toArray(),
    db.collection('crm_deals').countDocuments(match),
  ]);

  const rows: DealsFilteredRow[] = (docs as Array<Record<string, unknown> & { _id: { toString(): string } }>).map((d) => ({
    id: String(d._id),
    name: String(d.name || 'Untitled deal'),
    stage: String(d.stage || 'Unknown'),
    value: Number(d.value || 0),
    owner: String(d.ownerName || d.owner || '—'),
    pipeline: String(d.pipeline || '—'),
    accountId: d.accountId ? String(d.accountId) : undefined,
    createdAt: d.createdAt ? new Date(d.createdAt as string | Date).toISOString() : null,
  }));

  return { rows, total };
}

/* ─── Payment Report deep ────────────────────────────────────── */

export async function getPaymentReportDeep(
  fyAnchor?: string,
): Promise<{
  kpis: PaymentReportKpis;
  mtdByDay: PaymentMtdRow[];
  byMethod: PaymentMethodRow[];
  rows: PaymentReceiptRow[];
  fyLabel: string;
}> {
  const empty = {
    kpis: { receivedMtd: 0, pendingReceipts: 0, overdueAmount: 0, avgDsoDays: 0, monthTarget: 0 },
    mtdByDay: [] as PaymentMtdRow[],
    byMethod: [] as PaymentMethodRow[],
    rows: [] as PaymentReceiptRow[],
    fyLabel: '',
  };
  const user = await requireSession();
  if (!user) return empty;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [mtdAgg, byMethodAgg, pending, openInvoicesForDso, receipts] = await Promise.all([
    db.collection('crm_payment_receipts').aggregate([
      {
        $match: {
          userId: toOid(user),
          receiptDate: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$receiptDate' } },
          received: { $sum: { $ifNull: ['$totalAmountReceived', '$amount'] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('crm_payment_receipts').aggregate([
      {
        $match: {
          userId: toOid(user),
          receiptDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$mode', { $ifNull: ['$paymentMode', 'cash'] }] },
          total: { $sum: { $ifNull: ['$totalAmountReceived', '$amount'] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          status: { $in: ['Sent', 'Partially Paid', 'Overdue'] },
        },
      },
      {
        $group: {
          _id: null,
          pending: {
            $sum: {
              $subtract: [
                { $ifNull: ['$total', 0] },
                { $ifNull: ['$paidAmount', 0] },
              ],
            },
          },
          overdue: {
            $sum: {
              $cond: [
                { $lt: ['$dueDate', now] },
                {
                  $subtract: [
                    { $ifNull: ['$total', 0] },
                    { $ifNull: ['$paidAmount', 0] },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]).toArray(),
    db.collection('crm_invoices').find({
      userId: toOid(user),
      status: { $in: ['Paid', 'Partially Paid'] },
      invoiceDate: { $gte: fy.start, $lte: fy.end },
    }).project({ invoiceDate: 1, paidAt: 1, updatedAt: 1, total: 1, paidAmount: 1 }).limit(500).toArray(),
    db.collection('crm_payment_receipts').aggregate([
      {
        $match: {
          userId: toOid(user),
          receiptDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $lookup: {
          from: 'crm_accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'acct',
        },
      },
      { $sort: { receiptDate: -1 } },
      { $limit: 500 },
    ]).toArray(),
  ]);

  let dsoSum = 0;
  let dsoN = 0;
  for (const inv of openInvoicesForDso as any[]) {
    const paidAt = inv.paidAt ? new Date(inv.paidAt) : inv.updatedAt ? new Date(inv.updatedAt) : null;
    const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
    if (paidAt && invDate) {
      const days = Math.max(0, (paidAt.getTime() - invDate.getTime()) / 86400000);
      dsoSum += days;
      dsoN += 1;
    }
  }
  const avgDsoDays = dsoN > 0 ? dsoSum / dsoN : 0;

  const receivedMtd = (mtdAgg as any[]).reduce((s, r) => s + (r.received || 0), 0);

  // Month target: linearly extrapolated from prior 3 months' average.
  const priorMonths = await db.collection('crm_payment_receipts').aggregate([
    {
      $match: {
        userId: toOid(user),
        receiptDate: { $gte: new Date(now.getFullYear(), now.getMonth() - 3, 1), $lt: monthStart },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$receiptDate' } },
        total: { $sum: { $ifNull: ['$totalAmountReceived', '$amount'] } },
      },
    },
  ]).toArray();
  const monthTarget = priorMonths.length > 0
    ? (priorMonths as any[]).reduce((s, r) => s + (r.total || 0), 0) / priorMonths.length
    : receivedMtd * 1.1;

  const mtdByDay: PaymentMtdRow[] = (mtdAgg as any[]).map((r) => ({
    period: r._id,
    received: r.received || 0,
    target: monthTarget / 30,
  }));

  const rows: PaymentReceiptRow[] = (receipts as any[]).map((rec) => {
    const apply = Array.isArray(rec.applyTo) ? rec.applyTo : [];
    const first = apply[0] || {};
    return {
      id: String(rec._id),
      receiptNumber: String(rec.receiptNumber || rec.receiptNo || '—'),
      date: rec.receiptDate ? new Date(rec.receiptDate).toISOString().slice(0, 10) : '',
      clientName: rec.acct?.[0]?.name || rec.clientName || 'Unknown',
      amount: Number(rec.totalAmountReceived || rec.amount || 0),
      method: String(rec.mode || rec.paymentMode || 'cash'),
      invoiceNumber: String(rec.invoiceNumber || ''),
      invoiceId: String(first.invoiceId || ''),
    };
  });

  return {
    kpis: {
      receivedMtd,
      pendingReceipts: Number((pending[0] as any)?.pending || 0),
      overdueAmount: Number((pending[0] as any)?.overdue || 0),
      avgDsoDays,
      monthTarget,
    },
    mtdByDay,
    byMethod: (byMethodAgg as any[]).map((r) => ({
      method: String(r._id || 'cash'),
      total: r.total || 0,
      count: r.count || 0,
    })),
    rows,
    fyLabel: fy.label,
  };
}

/* ─── Overdue Tasks deep ─────────────────────────────────────── */

export interface OverdueTasksDeepFilters {
  projectId?: string;
  assigneeId?: string;
  priority?: string;
  minDaysOverdue?: number;
  maxDaysOverdue?: number;
}

export interface OverdueTaskDetailRow {
  _id: string;
  title: string;
  projectName: string;
  assignedTo: string;
  dueDate: string | null;
  daysOverdue: number;
  priority: string;
  status: string;
}

export interface OverdueTasksDeepResult {
  kpis: {
    total: number;
    overdueToday: number;
    overdueThisWeek: number;
    avgOverdueDays: number;
  };
  byAssignee: Array<{ assignee: string; count: number }>;
  rows: OverdueTaskDetailRow[];
}

export async function getOverdueTasksDeep(
  filters: OverdueTasksDeepFilters = {},
): Promise<OverdueTasksDeepResult> {
  const user = await requireSession();
  const empty: OverdueTasksDeepResult = {
    kpis: { total: 0, overdueToday: 0, overdueThisWeek: 0, avgOverdueDays: 0 },
    byAssignee: [],
    rows: [],
  };
  if (!user) return empty;
  const { db } = await connectToDatabase();

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const match: Record<string, unknown> = {
    userId: toOid(user),
    dueDate: { $lt: todayEnd },
    status: { $ne: 'Completed' },
  };
  if (filters.assigneeId && ObjectId.isValid(filters.assigneeId)) {
    match.assignedTo = new ObjectId(filters.assigneeId);
  }
  if (filters.priority) match.priority = filters.priority;
  if (filters.projectId && ObjectId.isValid(filters.projectId)) {
    match.projectId = new ObjectId(filters.projectId);
  }

  const tasks = await db
    .collection('crm_tasks')
    .find(match)
    .sort({ dueDate: 1 })
    .limit(500)
    .toArray();
  const nowMs = now.getTime();

  const filtered = tasks.filter((t: any) => {
    const due = t.dueDate ? new Date(t.dueDate).getTime() : nowMs;
    const days = Math.max(0, Math.floor((nowMs - due) / 86400000));
    if (filters.minDaysOverdue != null && days < filters.minDaysOverdue) return false;
    if (filters.maxDaysOverdue != null && days > filters.maxDaysOverdue) return false;
    return true;
  });

  const assigneeIdSet = new Set<string>();
  const projectIdSet = new Set<string>();
  for (const t of filtered as any[]) {
    if (t.assignedTo) assigneeIdSet.add(t.assignedTo.toString());
    if (t.projectId) projectIdSet.add(t.projectId.toString());
  }

  const [employees, projects] = await Promise.all([
    assigneeIdSet.size > 0
      ? db
          .collection('crm_employees')
          .find({
            userId: toOid(user),
            _id: {
              $in: Array.from(assigneeIdSet)
                .filter(ObjectId.isValid)
                .map((id) => new ObjectId(id)),
            },
          })
          .project({ firstName: 1, lastName: 1, email: 1 })
          .toArray()
      : Promise.resolve([]),
    projectIdSet.size > 0
      ? db
          .collection('crm_projects')
          .find({
            userId: toOid(user),
            _id: {
              $in: Array.from(projectIdSet)
                .filter(ObjectId.isValid)
                .map((id) => new ObjectId(id)),
            },
          })
          .project({ title: 1, name: 1 })
          .toArray()
      : Promise.resolve([]),
  ]);

  const empName = new Map<string, string>();
  for (const e of employees as any[]) {
    empName.set(
      e._id.toString(),
      `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
    );
  }
  const projName = new Map<string, string>();
  for (const p of projects as any[]) {
    projName.set(p._id.toString(), String(p.title || p.name || 'Unknown'));
  }

  let daysSum = 0;
  let overdueToday = 0;
  let overdueThisWeek = 0;
  const byAssigneeMap = new Map<string, number>();
  const rows: OverdueTaskDetailRow[] = [];

  for (const t of filtered as any[]) {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const dueMs = due ? due.getTime() : nowMs;
    const days = Math.max(0, Math.floor((nowMs - dueMs) / 86400000));
    daysSum += days;

    if (due && due >= todayStart && due <= todayEnd) overdueToday += 1;
    if (due && due >= weekAgo) overdueThisWeek += 1;

    const assigneeIdStr = t.assignedTo ? t.assignedTo.toString() : '';
    const assigneeName = assigneeIdStr
      ? (empName.get(assigneeIdStr) || 'Unknown')
      : 'Unassigned';
    byAssigneeMap.set(assigneeName, (byAssigneeMap.get(assigneeName) || 0) + 1);

    rows.push({
      _id: t._id.toString(),
      title: String(t.title || '(untitled)'),
      projectName: t.projectId ? (projName.get(t.projectId.toString()) || '—') : '—',
      assignedTo: assigneeName,
      dueDate: due ? due.toISOString() : null,
      daysOverdue: days,
      priority: String(t.priority || 'Medium'),
      status: String(t.status || 'To-Do'),
    });
  }

  const byAssignee = Array.from(byAssigneeMap.entries())
    .map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    kpis: {
      total: filtered.length,
      overdueToday,
      overdueThisWeek,
      avgOverdueDays:
        filtered.length > 0 ? Math.round(daysSum / filtered.length) : 0,
    },
    byAssignee,
    rows,
  };
}

/* ─── Task Report deep (with table rows) ────────────────────── */

export interface TaskDetailFilters {
  projectId?: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  from?: string;
  to?: string;
}

export interface TaskDetailRow {
  _id: string;
  title: string;
  projectName: string;
  assignedTo: string;
  status: string;
  priority: string;
  createdAt: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface TaskReportDeepResult {
  kpis: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRatePct: number;
  };
  weeklyCompleted: Array<{ week: string; count: number }>;
  rows: TaskDetailRow[];
}

export async function getTaskReportDeep(
  filters: TaskDetailFilters = {},
): Promise<TaskReportDeepResult> {
  const user = await requireSession();
  const empty: TaskReportDeepResult = {
    kpis: { total: 0, completed: 0, inProgress: 0, overdue: 0, completionRatePct: 0 },
    weeklyCompleted: [],
    rows: [],
  };
  if (!user) return empty;
  const { db } = await connectToDatabase();

  const match: Record<string, unknown> = { userId: toOid(user) };
  if (filters.status) match.status = filters.status;
  if (filters.priority) match.priority = filters.priority;
  if (filters.assigneeId && ObjectId.isValid(filters.assigneeId)) {
    match.assignedTo = new ObjectId(filters.assigneeId);
  }
  if (filters.projectId && ObjectId.isValid(filters.projectId)) {
    match.projectId = new ObjectId(filters.projectId);
  }
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = new Date(filters.from);
    if (filters.to) range.$lte = new Date(filters.to);
    match.createdAt = range;
  }

  const completedMatch = { ...match, status: 'Completed' };

  const [tasks, weeklyAgg] = await Promise.all([
    db.collection('crm_tasks').find(match).sort({ createdAt: -1 }).limit(500).toArray(),
    db
      .collection('crm_tasks')
      .aggregate([
        { $match: completedMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%G-W%V',
                date: { $ifNull: ['$updatedAt', '$createdAt'] },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 26 },
      ])
      .toArray(),
  ]);

  const nowMs = Date.now();

  const assigneeIdSet = new Set<string>();
  const projectIdSet = new Set<string>();
  for (const t of tasks as any[]) {
    if (t.assignedTo) assigneeIdSet.add(t.assignedTo.toString());
    if (t.projectId) projectIdSet.add(t.projectId.toString());
  }

  const [employees, projects] = await Promise.all([
    assigneeIdSet.size > 0
      ? db
          .collection('crm_employees')
          .find({
            userId: toOid(user),
            _id: {
              $in: Array.from(assigneeIdSet)
                .filter(ObjectId.isValid)
                .map((id) => new ObjectId(id)),
            },
          })
          .project({ firstName: 1, lastName: 1, email: 1 })
          .toArray()
      : Promise.resolve([]),
    projectIdSet.size > 0
      ? db
          .collection('crm_projects')
          .find({
            userId: toOid(user),
            _id: {
              $in: Array.from(projectIdSet)
                .filter(ObjectId.isValid)
                .map((id) => new ObjectId(id)),
            },
          })
          .project({ title: 1, name: 1 })
          .toArray()
      : Promise.resolve([]),
  ]);

  const empName = new Map<string, string>();
  for (const e of employees as any[]) {
    empName.set(
      e._id.toString(),
      `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
    );
  }
  const projName = new Map<string, string>();
  for (const p of projects as any[]) {
    projName.set(p._id.toString(), String(p.title || p.name || 'Unknown'));
  }

  let completed = 0;
  let inProgress = 0;
  let overdue = 0;
  const rows: TaskDetailRow[] = [];

  for (const t of tasks as any[]) {
    const status = String(t.status || 'To-Do');
    if (status === 'Completed') completed += 1;
    else if (status === 'In Progress') inProgress += 1;

    const due = t.dueDate ? new Date(t.dueDate) : null;
    if (due && due.getTime() < nowMs && status !== 'Completed') overdue += 1;

    const assigneeIdStr = t.assignedTo ? t.assignedTo.toString() : '';
    const assigneeName = assigneeIdStr ? (empName.get(assigneeIdStr) || 'Unknown') : '—';
    const pName = t.projectId ? (projName.get(t.projectId.toString()) || '—') : '—';

    rows.push({
      _id: t._id.toString(),
      title: String(t.title || '(untitled)'),
      projectName: pName,
      assignedTo: assigneeName,
      status,
      priority: String(t.priority || 'Medium'),
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : '',
      dueDate: due ? due.toISOString() : null,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    });
  }

  const total = tasks.length;

  return {
    kpis: {
      total,
      completed,
      inProgress,
      overdue,
      completionRatePct:
        total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    },
    weeklyCompleted: (weeklyAgg as any[]).map((r) => ({
      week: String(r._id || ''),
      count: Number(r.count || 0),
    })),
    rows,
  };
}
