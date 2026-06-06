'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import { CalendarOff, CheckCircle2, Clock, Hourglass, XCircle, } from 'lucide-react';

/**
 * <LeaveKpiStrip> — KPI strip for the canonical leave list (per §1D.1).
 *
 * 5 cards: Pending · Approved · Rejected · Available balance (current
 * user) · Used this month. Each is clickable so users can pivot the
 * list filter directly from a KPI.
 */

import * as React from 'react';

import type { LeaveKpiKey, LeaveKpiSnapshot } from './types';

interface LeaveKpiStripProps {
  kpi: LeaveKpiSnapshot;
  active?: LeaveKpiKey | null;
  onSelect: (key: LeaveKpiKey) => void;
}

export function LeaveKpiStrip({
  kpi,
  active,
  onSelect,
}: LeaveKpiStripProps): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'pending'}
        onClick={() => onSelect('pending')}
        ariaLabel="Show pending leave requests"
      >
        <StatCard
          label="Pending"
          value={kpi.pending.toLocaleString()}
          period="awaiting approval"
          icon={<Hourglass />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'approved'}
        onClick={() => onSelect('approved')}
        ariaLabel="Show approved leave requests"
      >
        <StatCard
          label="Approved"
          value={kpi.approved.toLocaleString()}
          period="active period"
          icon={<CheckCircle2 />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'rejected'}
        onClick={() => onSelect('rejected')}
        ariaLabel="Show rejected leave requests"
      >
        <StatCard
          label="Rejected"
          value={kpi.rejected.toLocaleString()}
          period="denied / cancelled"
          icon={<XCircle />}
          invertDelta
        />
      </KpiButton>
      <KpiButton
        active={active === 'balance'}
        onClick={() => onSelect('balance')}
        ariaLabel="Show my available leave balance"
      >
        <StatCard
          label="Available balance"
          value={
            kpi.availableBalance != null
              ? `${kpi.availableBalance.toFixed(1)} d`
              : '—'
          }
          period="your balance"
          icon={<CalendarOff />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'used'}
        onClick={() => onSelect('used')}
        ariaLabel="Show leave used this month"
      >
        <StatCard
          label="Used this month"
          value={`${kpi.usedThisMonth.toFixed(1)} d`}
          period="approved · current month"
          icon={<Clock />}
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
