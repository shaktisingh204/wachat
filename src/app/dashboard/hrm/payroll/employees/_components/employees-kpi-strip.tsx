'use client';

/**
 * <EmployeesKpiStrip> — KPI strip for the canonical Employees list.
 *
 * 5 cards: total · active · on leave · terminated/resigned · avg tenure
 * months. Each clickable card pivots the list filter to the matching
 * preset.
 */

import * as React from 'react';
import {
  Users,
  UserCheck,
  PlaneTakeoff,
  UserMinus,
  Hourglass,
} from 'lucide-react';

import { ZoruStatCard } from '@/components/zoruui';

import type { EmployeeKpiSnapshot, EmployeePresetKey } from './types';

interface EmployeesKpiStripProps {
  kpi: EmployeeKpiSnapshot;
  /** Currently-active preset — used to highlight the corresponding card. */
  active?: EmployeePresetKey | null;
  onSelect: (preset: EmployeePresetKey | 'reset' | 'terminated') => void;
}

export function EmployeesKpiStrip({
  kpi,
  active,
  onSelect,
}: EmployeesKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'all-active' || active == null}
        onClick={() => onSelect('reset')}
        ariaLabel="Show all employees"
      >
        <ZoruStatCard
          label="Total"
          value={kpi.total.toLocaleString()}
          period="all employees"
          icon={<Users />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'all-active'}
        onClick={() => onSelect('all-active')}
        ariaLabel="Show active employees"
      >
        <ZoruStatCard
          label="Active"
          value={kpi.active.toLocaleString()}
          period="currently working"
          icon={<UserCheck />}
        />
      </KpiButton>
      <KpiButton
        active={false}
        onClick={() => onSelect('all-active')}
        ariaLabel="Show employees on leave"
      >
        <ZoruStatCard
          label="On leave"
          value={kpi.onLeave.toLocaleString()}
          period="away from work"
          icon={<PlaneTakeoff />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'terminated'}
        onClick={() => onSelect('terminated')}
        ariaLabel="Show terminated or resigned employees"
      >
        <ZoruStatCard
          label="Terminated / Resigned"
          value={kpi.terminated.toLocaleString()}
          period="left the company"
          icon={<UserMinus />}
          invertDelta
        />
      </KpiButton>
      <ZoruStatCard
        label="Avg tenure"
        value={
          kpi.avgTenureMonths != null
            ? `${kpi.avgTenureMonths.toFixed(1)} mo`
            : '—'
        }
        period="active employees"
        icon={<Hourglass />}
      />
    </div>
  );
}

function KpiButton({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={Boolean(active)}
      className={[
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
