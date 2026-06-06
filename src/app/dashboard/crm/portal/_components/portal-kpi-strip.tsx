'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { Activity, Eye, Layers, Users } from 'lucide-react';

/**
 * KPI strip for the Portal Users list (§1D.1).
 *
 *  • Active users     — status === 'active'
 *  • Last login       — count of users seen in the last 7 days
 *  • By type          — number of distinct portalType values
 *  • Capability count — distinct capabilities across users
 */

import * as React from 'react';

import type { PortalUserRow } from './portal-types';

export type PortalKpiKey = 'all' | 'active' | 'recent';

export interface PortalKpiCounts {
  active: number;
  recentLogins: number;
  distinctTypes: number;
  distinctCapabilities: number;
}

export function computePortalKpis(rows: PortalUserRow[]): PortalKpiCounts {
  const now = Date.now();
  const sevenDays = now - 7 * 24 * 60 * 60 * 1000;
  const types = new Set<string>();
  const caps = new Set<string>();
  let active = 0;
  let recentLogins = 0;
  for (const r of rows) {
    if ((r.status ?? '').toLowerCase() === 'active') active += 1;
    if (r.portalType) types.add(r.portalType);
    if (r.capabilities) for (const c of r.capabilities) caps.add(c);
    if (r.lastLoginAt) {
      const t = new Date(r.lastLoginAt).getTime();
      if (Number.isFinite(t) && t >= sevenDays) recentLogins += 1;
    }
  }
  return {
    active,
    recentLogins,
    distinctTypes: types.size,
    distinctCapabilities: caps.size,
  };
}

export interface PortalKpiStripProps {
  counts: PortalKpiCounts;
  active: PortalKpiKey;
  onPick: (next: PortalKpiKey) => void;
}

export function PortalKpiStrip({
  counts,
  active,
  onPick,
}: PortalKpiStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Active users"
        value={counts.active.toLocaleString()}
        icon={<Users className="h-4 w-4" />}
        active={active === 'active'}
        onClick={() => onPick(active === 'active' ? 'all' : 'active')}
      />
      <KpiCard
        label="Login (7d)"
        value={counts.recentLogins.toLocaleString()}
        icon={<Eye className="h-4 w-4" />}
        active={active === 'recent'}
        onClick={() => onPick(active === 'recent' ? 'all' : 'recent')}
      />
      <KpiCard
        label="By type"
        value={counts.distinctTypes.toLocaleString()}
        icon={<Layers className="h-4 w-4" />}
        active={false}
        onClick={() => onPick('all')}
      />
      <KpiCard
        label="Capabilities"
        value={counts.distinctCapabilities.toLocaleString()}
        icon={<Activity className="h-4 w-4" />}
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
        'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
        active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-[var(--st-text)]' : '',
      ].join(' ')}
    >
      <StatCard label={label} value={value} icon={icon} />
    </button>
  );
}

export default PortalKpiStrip;
