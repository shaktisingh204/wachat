'use server';

import { gate } from '@/lib/sabhrm/gate';
import { SABHRM_COLLECTIONS } from '@/lib/sabhrm/collections';
import type { ActionResult, SabHrmDashboardData, PayrollStatus } from '@/lib/sabhrm/types';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthDay(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getSabHrmDashboard(): Promise<ActionResult<SabHrmDashboardData>> {
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
    const holidays = db.collection(SABHRM_COLLECTIONS.holidays);
    const today = todayISO();

    const [
      headcount,
      activeCount,
      onLeaveToday,
      presentToday,
      pendingLeaveApprovals,
      departmentCount,
      latestRun,
      deptAgg,
      joinerDocs,
      empForDates,
      holidayDocs,
    ] = await Promise.all([
      employees.countDocuments(filter),
      employees.countDocuments({ ...filter, status: 'active' }),
      attendance.countDocuments({ ...filter, date: today, status: 'on_leave' }),
      attendance.countDocuments({ ...filter, date: today, status: { $in: ['present', 'late', 'half_day'] } }),
      leave.countDocuments({ ...filter, status: 'pending' }),
      departments.countDocuments(filter),
      payrollRuns.find(filter).sort({ periodYear: -1, periodMonth: -1 }).limit(1).toArray(),
      employees
        .aggregate([
          { $match: filter },
          { $group: { _id: '$departmentName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ])
        .toArray(),
      employees.find(filter).sort({ dateOfJoining: -1 }).limit(5).toArray(),
      employees
        .find(filter, { projection: { firstName: 1, lastName: 1, displayName: 1, dob: 1, dateOfJoining: 1 } })
        .limit(500)
        .toArray(),
      holidays.find(filter).limit(200).toArray(),
    ]);

    // Upcoming birthdays / anniversaries within the next 30 days (by month-day).
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const inWindow = (md: string): boolean => {
      // Compare month-day across the rolling 30-day window (handles year wrap).
      const cur = monthDay(now);
      const end = monthDay(horizon);
      return cur <= end ? md >= cur && md <= end : md >= cur || md <= end;
    };
    const upcoming: SabHrmDashboardData['upcoming'] = [];
    for (const e of empForDates as Array<Record<string, unknown>>) {
      const name = (e.displayName as string) || `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
      if (e.dob) {
        const d = new Date(e.dob as string | Date);
        if (!Number.isNaN(d.getTime()) && inWindow(monthDay(d))) {
          upcoming.push({ kind: 'birthday', label: `${name}'s birthday`, date: monthDay(d) });
        }
      }
      if (e.dateOfJoining) {
        const d = new Date(e.dateOfJoining as string | Date);
        if (!Number.isNaN(d.getTime()) && d < now && inWindow(monthDay(d))) {
          upcoming.push({ kind: 'anniversary', label: `${name}'s work anniversary`, date: monthDay(d) });
        }
      }
    }
    for (const h of holidayDocs as Array<Record<string, unknown>>) {
      if (h.date) {
        const iso = String(h.date).slice(0, 10);
        if (iso >= today && iso <= horizon.toISOString().slice(0, 10)) {
          upcoming.push({ kind: 'holiday', label: String(h.name ?? 'Holiday'), date: iso });
        }
      }
    }
    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    const latest = latestRun[0] as Record<string, unknown> | undefined;

    return {
      ok: true,
      data: {
        headcount,
        activeCount,
        onLeaveToday,
        presentToday,
        pendingLeaveApprovals,
        openPositions: 0,
        departmentCount,
        latestPayrollStatus: (latest?.status as PayrollStatus | undefined) ?? null,
        upcoming: upcoming.slice(0, 8),
        headcountByDepartment: (deptAgg as Array<{ _id: string | null; count: number }>).map((d) => ({
          name: d._id || 'Unassigned',
          count: d.count,
        })),
        recentJoiners: (joinerDocs as Array<Record<string, unknown>>).map((e) => ({
          id: String(e._id),
          name: (e.displayName as string) || `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
          date: e.dateOfJoining ? String(e.dateOfJoining).slice(0, 10) : '',
          designation: (e.designationName as string) ?? null,
        })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load dashboard.' };
  }
}
