'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { Activity, AlertTriangle, CheckCircle2, Gauge, Pause } from 'lucide-react';

/**
 * KPI strip for production orders — 5 stat cards required by §1D.
 */

import * as React from 'react';

import type { CrmProductionOrderKpis } from '@/app/actions/crm-production-orders.actions';

export type PoStatusFilter = 'all' | 'planned' | 'in_progress' | 'completed';

export interface PoKpiStripProps {
    kpis: CrmProductionOrderKpis;
    activeFilter: PoStatusFilter;
    onPick: (next: PoStatusFilter) => void;
}

export function PoKpiStrip({ kpis, activeFilter, onPick }: PoKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <KpiCard
                label="Open"
                value={kpis.open.toLocaleString()}
                icon={<Pause className="h-4 w-4" />}
                active={activeFilter === 'planned'}
                onClick={() => onPick(activeFilter === 'planned' ? 'all' : 'planned')}
            />
            <KpiCard
                label="In progress"
                value={kpis.inProgress.toLocaleString()}
                icon={<Activity className="h-4 w-4" />}
                active={activeFilter === 'in_progress'}
                onClick={() => onPick(activeFilter === 'in_progress' ? 'all' : 'in_progress')}
            />
            <KpiCard
                label="Completed"
                value={kpis.completed.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
                active={activeFilter === 'completed'}
                onClick={() => onPick(activeFilter === 'completed' ? 'all' : 'completed')}
            />
            <KpiCard
                label="Scrap rate"
                value={`${kpis.scrapRate.toFixed(1)}%`}
                icon={<AlertTriangle className="h-4 w-4" />}
                active={false}
                onClick={() => onPick('all')}
            />
            <KpiCard
                label="Avg yield"
                value={`${kpis.avgYieldPct.toFixed(1)}%`}
                icon={<Gauge className="h-4 w-4" />}
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
                active ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]' : '',
            ].join(' ')}
        >
            <ZoruStatCard label={label} value={value} icon={icon} />
        </button>
    );
}
