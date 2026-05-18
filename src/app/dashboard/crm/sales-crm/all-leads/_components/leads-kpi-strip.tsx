'use client';

import { ZoruStatCard } from '@/components/zoruui';
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
import type { CrmLeadKpis } from '@/app/actions/crm-leads.actions';

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
            <ZoruStatCard label={label} value={value} icon={icon} />
        </button>
    );
}

export default LeadsKpiStrip;
