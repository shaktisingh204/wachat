'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { Activity, CalendarClock, IndianRupee, Repeat, Timer } from 'lucide-react';

/**
 * KPI strip for Service Contracts (AMC) list (§1D.1).
 *
 *  • Active            — status === 'active'
 *  • Expiring 30d      — periodEnd within next 30 days
 *  • Renewals due      — renewalDue flag OR period within next 60d
 *  • Total billed      — sum of billedAmount (or value) across contracts
 *  • Avg coverage days — mean (periodEnd - periodStart) across rows
 */

import * as React from 'react';

import type { ServiceContractRow } from './service-contracts-types';

export type ServiceContractsKpiKey =
  | 'all'
  | 'active'
  | 'expiring30'
  | 'renewals';

export interface ServiceContractsKpiCounts {
  active: number;
  expiring30: number;
  renewalsDue: number;
  totalBilled: number;
  avgCoverageDays: number;
}

export function computeServiceContractKpis(
  rows: ServiceContractRow[],
): ServiceContractsKpiCounts {
  const now = Date.now();
  const horizon30 = now + 30 * 24 * 60 * 60 * 1000;
  const horizon60 = now + 60 * 24 * 60 * 60 * 1000;
  let active = 0;
  let expiring30 = 0;
  let renewalsDue = 0;
  let totalBilled = 0;
  let coverageSum = 0;
  let coverageN = 0;
  for (const c of rows) {
    if ((c.status ?? '').toLowerCase() === 'active') active += 1;
    const end = c.periodEnd ? new Date(c.periodEnd).getTime() : NaN;
    if (Number.isFinite(end) && end >= now && end <= horizon30) {
      expiring30 += 1;
    }
    if (
      c.renewalDue ||
      (Number.isFinite(end) && end >= now && end <= horizon60)
    ) {
      renewalsDue += 1;
    }
    if (typeof c.billedAmount === 'number') totalBilled += c.billedAmount;
    else if (typeof c.value === 'number') totalBilled += c.value;
    const start = c.periodStart ? new Date(c.periodStart).getTime() : NaN;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const days = Math.max(
        0,
        Math.round((end - start) / (24 * 60 * 60 * 1000)),
      );
      coverageSum += days;
      coverageN += 1;
    }
  }
  return {
    active,
    expiring30,
    renewalsDue,
    totalBilled,
    avgCoverageDays: coverageN > 0 ? Math.round(coverageSum / coverageN) : 0,
  };
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface ServiceContractsKpiStripProps {
  counts: ServiceContractsKpiCounts;
  active: ServiceContractsKpiKey;
  onPick: (next: ServiceContractsKpiKey) => void;
}

export function ServiceContractsKpiStrip({
  counts,
  active,
  onPick,
}: ServiceContractsKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Active"
        value={counts.active.toLocaleString()}
        icon={<Activity className="h-4 w-4" />}
        active={active === 'active'}
        onClick={() => onPick(active === 'active' ? 'all' : 'active')}
      />
      <KpiCard
        label="Expiring 30d"
        value={counts.expiring30.toLocaleString()}
        icon={<CalendarClock className="h-4 w-4" />}
        active={active === 'expiring30'}
        onClick={() => onPick(active === 'expiring30' ? 'all' : 'expiring30')}
      />
      <KpiCard
        label="Renewals due"
        value={counts.renewalsDue.toLocaleString()}
        icon={<Repeat className="h-4 w-4" />}
        active={active === 'renewals'}
        onClick={() => onPick(active === 'renewals' ? 'all' : 'renewals')}
      />
      <KpiCard
        label="Total billed"
        value={inr.format(counts.totalBilled)}
        icon={<IndianRupee className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Avg coverage"
        value={`${counts.avgCoverageDays} d`}
        icon={<Timer className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
        active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
      ].join(' ')}
    >
      <ZoruStatCard label={label} value={value} icon={icon} />
    </button>
  );
}

export default ServiceContractsKpiStrip;
