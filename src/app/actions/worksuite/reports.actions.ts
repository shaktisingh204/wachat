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
  AgentPerformanceRow,
  TaskReportFilters,
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

export async function getTopClients(limit = 10): Promise<TopClientRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const rows = await db.collection('crm_invoices').aggregate([
    {
      $match: {
        userId: toOid(user),
        status: { $in: ['Paid', 'Partially Paid'] },
      },
    },
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

export async function getTopProducts(limit = 10): Promise<TopProductRow[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const rows = await db.collection('crm_invoices').aggregate([
    { $match: { userId: toOid(user) } },
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
    };
  }
  const { db } = await connectToDatabase();
  const { start, end } = defaultRange(from, to);

  const match = {
    userId: toOid(user),
    createdAt: { $gte: start, $lte: end },
  };

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

  for (const t of tickets) {
    const tk = t as any;
    const status = tk.status || 'open';
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
    if (['resolved', 'closed'].includes(status)) resolved++;
    else open++;

    byChannel.set(
      tk.channel || 'other',
      (byChannel.get(tk.channel || 'other') || 0) + 1,
    );
    byAgent.set(
      tk.assigneeName || 'Unassigned',
      (byAgent.get(tk.assigneeName || 'Unassigned') || 0) + 1,
    );

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
  };
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

