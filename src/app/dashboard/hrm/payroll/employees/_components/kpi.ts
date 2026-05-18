/**
 * KPI aggregator for the Employees list page.
 *
 * Server-only — invoked by the page component before handing data off
 * to the client island. Keeps the §1D KPI strip independent of the
 * wider window used elsewhere.
 */

import type { CrmEmployeeDoc } from '@/lib/rust-client/crm-employees';

import type { EmployeeKpiSnapshot } from './types';

export function computeEmployeeKpis(
  docs: CrmEmployeeDoc[],
): EmployeeKpiSnapshot {
  let total = 0;
  let active = 0;
  let onLeave = 0;
  let onNotice = 0;
  let newThisMonth = 0;
  let terminated = 0;
  let tenureSumMonths = 0;
  let tenureCount = 0;
  const nowDate = new Date();
  const now = nowDate.getTime();
  const monthStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    1,
  ).getTime();

  for (const e of docs) {
    if (e.archived) continue;
    total += 1;
    const status = e.status;
    if (status === 'active') {
      active += 1;
      if (e.joiningDate) {
        const t = new Date(e.joiningDate).getTime();
        if (!Number.isNaN(t) && t <= now) {
          const months = (now - t) / (1000 * 60 * 60 * 24 * 30.4375);
          if (Number.isFinite(months) && months >= 0) {
            tenureSumMonths += months;
            tenureCount += 1;
          }
        }
      }
    } else if (status === 'on_leave') {
      onLeave += 1;
    } else if (status === 'resigned') {
      onNotice += 1;
    } else if (status === 'terminated') {
      terminated += 1;
    }
    if (e.joiningDate) {
      const t = new Date(e.joiningDate).getTime();
      if (!Number.isNaN(t) && t >= monthStart) {
        newThisMonth += 1;
      }
    }
  }

  return {
    total,
    active,
    onLeave,
    onNotice,
    newThisMonth,
    terminated,
    avgTenureMonths:
      tenureCount > 0 ? Math.round((tenureSumMonths / tenureCount) * 10) / 10 : null,
  };
}
