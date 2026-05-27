'use client';

import { StatCard, Skeleton } from '@/components/zoruui';
import { use } from 'react';
import { BarChart3, CheckCircle2, Sparkles, Trophy, Users } from 'lucide-react';

/**
 * KPI strip for the leads list page — 4 stat cards plus the conversion
 * funnel chart taking the trailing two columns on lg screens.
 *
 * Each card is a button that toggles a status filter. Clicking Total
 * clears all filters (the parent's `onClearAll`).
 */

import * as React from 'react';

import { LeadsFunnel, type LeadsFunnelStage } from './leads-funnel';
import type { LeadsStatusFilter } from './leads-filters';
import type { CrmLeadKpis } from '@/app/actions/crm-leads.actions.types';
export interface LeadsKpiStripProps {
    kpis: CrmLeadKpis;
    statusFilter: LeadsStatusFilter;
    hasActiveFilters: boolean;
    funnelStages: LeadsFunnelStage[];
    onClearAll: () => void;
    onPickStatus: (status: LeadsStatusFilter) => void;
}

export function LeadsKpiStrip({
    kpis,
    statusFilter,
    hasActiveFilters,
    funnelStages,
    onClearAll,
    onPickStatus,
}: LeadsKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <KpiCard
                label="Total"
                value={kpis.total.toLocaleString()}
                icon={<Users className="h-4 w-4" />}
                active={statusFilter === 'all' && !hasActiveFilters}
                onClick={onClearAll}
            />
            <KpiCard
                label="New"
                value={kpis.newCount.toLocaleString()}
                icon={<Sparkles className="h-4 w-4" />}
                active={statusFilter === 'New'}
                onClick={() => onPickStatus('New')}
            />
            <KpiCard
                label="Qualified"
                value={kpis.qualifiedCount.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
                active={statusFilter === 'Qualified'}
                onClick={() => onPickStatus('Qualified')}
            />
            <KpiCard
                label="Won"
                value={kpis.wonCount.toLocaleString()}
                icon={<Trophy className="h-4 w-4" />}
                active={statusFilter === 'Won'}
                onClick={() => onPickStatus('Won')}
            />
            <div className="md:col-span-2 lg:col-span-2">
                <LeadsFunnel
                    stages={funnelStages}
                    activeKey={statusFilter !== 'all' ? statusFilter : undefined}
                    onSelect={(k) => onPickStatus(k as LeadsStatusFilter)}
                />
            </div>
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
            <StatCard label={label} value={value} icon={icon} />
        </button>
    );
}

export function LeadsKpiStripAsync({
    kpisPromise,
    leads,
    statusFilter,
    hasActiveFilters,
    onClearAll,
    onPickStatus,
}: Omit<LeadsKpiStripProps, 'kpis' | 'funnelStages'> & { kpisPromise: Promise<CrmLeadKpis>; leads: any[] }) {
    const kpis = use(kpisPromise);
    const funnelStages = React.useMemo(() => {
        const counters = { Contacted: 0, Proposal: 0 } as Record<string, number>;
        for (const l of leads) {
            const s = String((l as any).status ?? '').trim();
            if (s === 'Contacted') counters.Contacted += 1;
            if (s === 'Proposal' || (l as any).stage === 'Proposal') counters.Proposal += 1;
        }
        return [
            { key: 'New', label: 'New', count: kpis.newCount },
            { key: 'Contacted', label: 'Contacted', count: counters.Contacted },
            { key: 'Qualified', label: 'Qualified', count: kpis.qualifiedCount },
            { key: 'Proposal', label: 'Proposal', count: counters.Proposal },
            { key: 'Won', label: 'Won', count: kpis.wonCount },
        ];
    }, [kpis, leads]);

    return (
        <LeadsKpiStrip
            kpis={kpis}
            statusFilter={statusFilter}
            hasActiveFilters={hasActiveFilters}
            funnelStages={funnelStages}
            onClearAll={onClearAll}
            onPickStatus={onPickStatus}
        />
    );
}

export function LeadsKpiStripSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-4 space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-7 w-20" />
                </div>
            ))}
            <div className="md:col-span-2 lg:col-span-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-1 items-end h-[40px] pt-2">
                    <Skeleton className="h-full w-full bg-zoru-line/50" />
                    <Skeleton className="h-[80%] w-full bg-zoru-line/50" />
                    <Skeleton className="h-[60%] w-full bg-zoru-line/50" />
                    <Skeleton className="h-[40%] w-full bg-zoru-line/50" />
                    <Skeleton className="h-[20%] w-full bg-zoru-line/50" />
                </div>
            </div>
        </div>
    );
}

export default LeadsKpiStrip;
