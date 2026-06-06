'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import {
  AlertCircle,
  CircleDollarSign,
  PauseCircle,
  PlayCircle,
  Sparkles,
  } from 'lucide-react';

/**
 * <SubscriptionKpiStrip> — KPI strip for the canonical subscriptions list.
 *
 * 5 cards: Active · Trial · Past-due · Churned · MRR. Each card is a
 * filter chip — clicking it scopes the list to that status (or clears
 * the filter when the chip is already active).
 *
 * Pure presentational — parent owns active state + onSelect handler.
 */

import * as React from 'react';

import type { SubscriptionKpiSnapshot } from '@/app/actions/crm/subscriptions.actions.types';

export type SubscriptionKpiKey =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'churned'
  | null;

interface SubscriptionKpiStripProps {
  kpi: SubscriptionKpiSnapshot;
  active: SubscriptionKpiKey;
  onSelect: (key: SubscriptionKpiKey) => void;
}

function fmtMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}

export function SubscriptionKpiStrip({
  kpi,
  active,
  onSelect,
}: SubscriptionKpiStripProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiButton
        active={active === 'active'}
        onClick={() => onSelect(active === 'active' ? null : 'active')}
        ariaLabel="Show active subscriptions"
      >
        <StatCard
          label="Active"
          value={kpi.activeCount.toLocaleString()}
          period="currently billing"
          icon={<PlayCircle />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'trial'}
        onClick={() => onSelect(active === 'trial' ? null : 'trial')}
        ariaLabel="Show trial subscriptions"
      >
        <StatCard
          label="Trial"
          value={kpi.trialCount.toLocaleString()}
          period="in trial window"
          icon={<Sparkles />}
        />
      </KpiButton>
      <KpiButton
        active={active === 'past_due'}
        onClick={() => onSelect(active === 'past_due' ? null : 'past_due')}
        ariaLabel="Show past-due subscriptions"
      >
        <StatCard
          label="Past due"
          value={kpi.pastDueCount.toLocaleString()}
          period="payment failed"
          icon={<AlertCircle />}
          invertDelta
        />
      </KpiButton>
      <KpiButton
        active={active === 'churned'}
        onClick={() => onSelect(active === 'churned' ? null : 'churned')}
        ariaLabel="Show churned subscriptions"
      >
        <StatCard
          label="Churned"
          value={kpi.churnedCount.toLocaleString()}
          period="cancelled or expired"
          icon={<PauseCircle />}
        />
      </KpiButton>
      <StatCard
        label="MRR"
        value={fmtMoney(kpi.mrr, kpi.currency)}
        period="active + trial"
        icon={<CircleDollarSign />}
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
        active
          ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary'
          : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
