/**
 * KPI aggregator for the Attendance list page.
 *
 * Server-only — invoked by the page component before handing data off
 * to the client island. The aggregate runs over the same window the
 * server pre-fetches for the KPI strip (200-row cap, today-anchored).
 */

import type { CrmAttendanceDoc } from '@/lib/rust-client/crm-attendance';

import type { AttendanceKpiSnapshot } from './types';

function sameUtcDay(iso?: string, refIsoDay?: string): boolean {
  if (!iso || !refIsoDay) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === refIsoDay;
}

export function computeAttendanceKpis(
  docs: CrmAttendanceDoc[],
): AttendanceKpiSnapshot {
  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenAgo = Date.now() - 7 * 86_400_000;

  let presentToday = 0;
  let onLeaveToday = 0;
  let lateToday = 0;
  let absentToday = 0;
  let hoursSum = 0;
  let hoursCount = 0;

  for (const a of docs) {
    const isToday = sameUtcDay(a.date, todayIso);
    if (isToday) {
      if (a.status === 'present' || a.status === 'wfh') presentToday += 1;
      else if (a.status === 'leave') onLeaveToday += 1;
      else if (a.status === 'absent') absentToday += 1;
      if ((a.lateByMinutes ?? 0) > 0) lateToday += 1;
    }
    // Avg-hours-this-week
    if (a.date) {
      const t = new Date(a.date).getTime();
      if (
        !Number.isNaN(t) &&
        t >= sevenAgo &&
        typeof a.totalHours === 'number' &&
        a.totalHours > 0
      ) {
        hoursSum += a.totalHours;
        hoursCount += 1;
      }
    }
  }

  return {
    presentToday,
    onLeaveToday,
    lateToday,
    absentToday,
    avgHoursThisWeek:
      hoursCount > 0 ? Math.round((hoursSum / hoursCount) * 10) / 10 : null,
  };
}
