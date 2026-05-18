'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { Users, UserCheck, PlaneTakeoff, UserMinus, UserPlus, } from 'lucide-react';

/**
 * <EmployeesKpiStrip> — KPI strip for the canonical Employees list.
 *
 * Per §1D.1: Total · Active · On leave · On notice · New this month.
 * Each clickable card pivots the list filter to the matching preset.
 * `terminated` lives behind the secondary "Terminated" toolbar preset
 * (the strip prioritises the headline counters above).
 */

import * as React from 'react';

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
        active={active == null}
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
        active={active === 'on-leave'}
        onClick={() => onSelect('on-leave')}
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
        active={active === 'on-notice'}
        onClick={() => onSelect('on-notice')}
        ariaLabel="Show employees on notice"
      >
        <ZoruStatCard
          label="On notice"
          value={kpi.onNotice.toLocaleString()}
          period="serving notice period"
          icon={<UserMinus />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'joined-this-month'}
        onClick={() => onSelect('joined-this-month')}
        ariaLabel="Show employees joined this month"
      >
        <ZoruStatCard
          label="New this month"
          value={kpi.newThisMonth.toLocaleString()}
          period="joined this month"
          icon={<UserPlus />}
        />
      </KpiButton>
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
