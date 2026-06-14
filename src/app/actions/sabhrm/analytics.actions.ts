'use server';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type {
  ActionResult,
  EmployeeStatus,
  EmploymentType,
  LeaveStatus,
} from '@/lib/sabhrm/types';

/* ── analytics result shape (surface-local; not in shared types.ts) ────── */

export interface NamedCount {
  name: string;
  count: number;
}

export interface SabHrmAnalyticsData {
  /** Total people in the directory. */
  headcount: number;
  /** Active employees only. */
  activeCount: number;
  /** Department count. */
  departmentCount: number;
  headcountByDepartment: NamedCount[];
  headcountByEmploymentType: NamedCount[];
  headcountByStatus: NamedCount[];
  /** Empty when no gender field is populated on any employee. */
  genderSplit: NamedCount[];
  /** Attendance over the trailing 30 days. */
  attendance: {
    rate: number; // 0..100 (present-ish / total records)
    presentRecords: number;
    totalRecords: number;
    windowDays: number;
  };
  leaveRequestsByStatus: NamedCount[];
  pendingLeaveApprovals: number;
  latestPayroll: {
    label: string | null;
    netTotal: number;
    status: string | null;
  };
}

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
  consultant: 'Consultant',
};

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  probation: 'Probation',
  on_leave: 'On leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
};

const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function labelEnum<T extends string>(value: T, labels: Record<T, string>): string {
  return labels[value] ?? value;
}

function aggToNamed<T extends string>(
  rows: Array<{ _id: T | null; count: number }>,
  labels: Record<T, string>,
  unassignedLabel: string,
): NamedCount[] {
  return rows.map((r) => ({
    name: r._id ? labelEnum(r._id, labels) : unassignedLabel,
    count: r.count,
  }));
}

export async function getSabHrmAnalytics(): Promise<ActionResult<SabHrmAnalyticsData>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;
  const filter = { workspaceId };

  try {
    const employees = db.collection(SABHRM_COLLECTIONS.employees);
    const attendance = db.collection(SABHRM_COLLECTIONS.attendance);
    const leave = db.collection(SABHRM_COLLECTIONS.leaveRequests);
    const departments = db.collection(SABHRM_COLLECTIONS.departments);
    const payrollRuns = db.collection(SABHRM_COLLECTIONS.payrollRuns);

    // Trailing 30-day attendance window (attendance.date is an ISO date string).
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromISO = from.toISOString().slice(0, 10);
    const toISO = now.toISOString().slice(0, 10);
    const presentStatuses = ['present', 'late', 'half_day'];

    const [
      headcount,
      activeCount,
      departmentCount,
      deptAgg,
      typeAgg,
      statusAgg,
      genderAgg,
      attendanceAgg,
      leaveAgg,
      pendingLeaveApprovals,
      latestRun,
    ] = await Promise.all([
      employees.countDocuments(filter),
      employees.countDocuments({ ...filter, status: 'active' }),
      departments.countDocuments(filter),
      employees
        .aggregate([
          { $match: filter },
          { $group: { _id: '$departmentName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 12 },
        ])
        .toArray(),
      employees
        .aggregate([
          { $match: filter },
          { $group: { _id: '$employmentType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      employees
        .aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      employees
        .aggregate([
          { $match: { ...filter, gender: { $nin: [null, ''] } } },
          { $group: { _id: '$gender', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      attendance
        .aggregate([
          { $match: { ...filter, date: { $gte: fromISO, $lte: toISO } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              present: {
                $sum: { $cond: [{ $in: ['$status', presentStatuses] }, 1, 0] },
              },
            },
          },
        ])
        .toArray(),
      leave
        .aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      leave.countDocuments({ ...filter, status: 'pending' }),
      payrollRuns.find(filter).sort({ periodYear: -1, periodMonth: -1 }).limit(1).toArray(),
    ]);

    const att = (attendanceAgg as Array<{ total?: number; present?: number }>)[0];
    const totalRecords = att?.total ?? 0;
    const presentRecords = att?.present ?? 0;
    const rate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    const latest = (latestRun as Array<Record<string, unknown>>)[0];

    const data: SabHrmAnalyticsData = {
      headcount,
      activeCount,
      departmentCount,
      headcountByDepartment: (deptAgg as Array<{ _id: string | null; count: number }>).map((d) => ({
        name: d._id || 'Unassigned',
        count: d.count,
      })),
      headcountByEmploymentType: aggToNamed(
        typeAgg as Array<{ _id: EmploymentType | null; count: number }>,
        EMPLOYMENT_TYPE_LABELS,
        'Unspecified',
      ),
      headcountByStatus: aggToNamed(
        statusAgg as Array<{ _id: EmployeeStatus | null; count: number }>,
        EMPLOYEE_STATUS_LABELS,
        'Unspecified',
      ),
      genderSplit: (genderAgg as Array<{ _id: string | null; count: number }>).map((d) => {
        const key = (d._id || '').toString().toLowerCase();
        const label =
          key === 'male' ? 'Male' : key === 'female' ? 'Female' : key === 'other' ? 'Other' : d._id || 'Unspecified';
        return { name: label, count: d.count };
      }),
      attendance: {
        rate,
        presentRecords,
        totalRecords,
        windowDays: 30,
      },
      leaveRequestsByStatus: aggToNamed(
        leaveAgg as Array<{ _id: LeaveStatus | null; count: number }>,
        LEAVE_STATUS_LABELS,
        'Unspecified',
      ),
      pendingLeaveApprovals,
      latestPayroll: {
        label: latest ? String(latest.label ?? '') || null : null,
        netTotal: latest && typeof latest.netTotal === 'number' ? latest.netTotal : 0,
        status: latest ? (latest.status as string | undefined) ?? null : null,
      },
    };

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load HR analytics.' };
  }
}
