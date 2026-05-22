'use client';

import { StatCard } from '@/components/zoruui';
import { CheckCircle2, Clock, Gauge, PlaneTakeoff, UserX, } from 'lucide-react';

/**
 * <AttendanceKpiStrip> — 5 KPI cards per §1D for the canonical list:
 * Present today · On leave today · Late today · Absent today · Avg
 * hours this week.
 *
 * Each clickable card pivots the list filter to the matching slice.
 */

import * as React from 'react';

import type { AttendanceKpiSnapshot, AttendancePresetKey } from './types';

interface AttendanceKpiStripProps {
  kpi: AttendanceKpiSnapshot;
  active?: AttendancePresetKey | 'reset' | null;
  onSelect: (preset: AttendancePresetKey | 'reset') => void;
}

export function AttendanceKpiStrip({
  kpi,
  active,
  onSelect,
}: AttendanceKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'today'}
        onClick={() => onSelect('today')}
        ariaLabel="Show present punches today"
      >
        <ZoruStatCard
          label="Present today"
          value={kpi.presentToday.toLocaleString()}
          period="on duty"
          icon={<CheckCircle2 />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'leave-only'}
        onClick={() => onSelect('leave-only')}
        ariaLabel="Show employees on leave today"
      >
        <ZoruStatCard
          label="On leave today"
          value={kpi.onLeaveToday.toLocaleString()}
          period="approved leave"
          icon={<PlaneTakeoff />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'late-only'}
        onClick={() => onSelect('late-only')}
        ariaLabel="Show late punches today"
      >
        <ZoruStatCard
          label="Late today"
          value={kpi.lateToday.toLocaleString()}
          period="behind schedule"
          icon={<Clock />}
          invertDelta
        />
      </KpiButton>
      <KpiButton
        active={active === 'reset'}
        onClick={() => onSelect('reset')}
        ariaLabel="Show absent today"
      >
        <ZoruStatCard
          label="Absent today"
          value={kpi.absentToday.toLocaleString()}
          period="no punch yet"
          icon={<UserX />}
          invertDelta
        />
      </KpiButton>
      <ZoruStatCard
        label="Avg hours / day"
        value={
          kpi.avgHoursThisWeek != null
            ? `${kpi.avgHoursThisWeek.toFixed(1)} h`
            : '—'
        }
        period="rolling 7 days"
        icon={<Gauge />}
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
