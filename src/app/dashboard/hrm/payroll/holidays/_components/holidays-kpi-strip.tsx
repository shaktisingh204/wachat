'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { CalendarHeart, Layers, Repeat, Sparkles, } from 'lucide-react';

/**
 * <HolidaysKpiStrip> — KPI strip for the canonical holidays list
 * (per §1D.1). 4 cards: Total this year · By type breakdown ·
 * This quarter · Recurring count.
 */

import * as React from 'react';

export interface HolidaysKpiSnapshot {
  totalThisYear: number;
  byTypeNational: number;
  byTypeRegional: number;
  byTypeReligious: number;
  byTypeOptional: number;
  byTypeRestricted: number;
  thisQuarter: number;
  recurringCount: number;
}

export type HolidaysKpiKey =
  | 'all-year'
  | 'breakdown'
  | 'this-quarter'
  | 'recurring';

interface HolidaysKpiStripProps {
  kpi: HolidaysKpiSnapshot;
  active?: HolidaysKpiKey | null;
  onSelect: (key: HolidaysKpiKey) => void;
}

export function HolidaysKpiStrip({
  kpi,
  active,
  onSelect,
}: HolidaysKpiStripProps): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiButton
        active={active === 'all-year'}
        onClick={() => onSelect('all-year')}
        ariaLabel="Show all holidays this year"
      >
        <StatCard
          label="This year"
          value={kpi.totalThisYear.toLocaleString()}
          period="all holiday types"
          icon={<CalendarHeart />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'breakdown'}
        onClick={() => onSelect('breakdown')}
        ariaLabel="Show holidays by type breakdown"
      >
        <StatCard
          label="By type"
          value={`${kpi.byTypeNational}·${kpi.byTypeRegional}·${kpi.byTypeReligious}`}
          period="National · Regional · Religious"
          icon={<Layers />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'this-quarter'}
        onClick={() => onSelect('this-quarter')}
        ariaLabel="Show holidays in the current quarter"
      >
        <StatCard
          label="This quarter"
          value={kpi.thisQuarter.toLocaleString()}
          period="upcoming + completed"
          icon={<Sparkles />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'recurring'}
        onClick={() => onSelect('recurring')}
        ariaLabel="Show recurring holidays"
      >
        <StatCard
          label="Recurring"
          value={kpi.recurringCount.toLocaleString()}
          period="repeats yearly"
          icon={<Repeat />}
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
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
        active
          ? 'rounded-[var(--st-radius-lg)] ring-1 ring-[var(--st-text)]'
          : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
