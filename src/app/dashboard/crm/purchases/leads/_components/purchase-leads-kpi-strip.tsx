'use client';

import * as React from 'react';
import { CheckCircle2, Percent, Target, Trophy } from 'lucide-react';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import type { CrmLeadKpis } from '@/app/actions/crm-leads.actions.types';

/**
 * KPI strip for the Purchases · Vendor Leads list page.
 *
 *   Total leads · Qualified · Won · Conversion rate
 *
 * Cards are clickable; clicking any non-summary card toggles the status
 * filter on the parent list.
 */

export type PurchaseLeadsKpiFilter = 'all' | 'qualified' | 'won';

export interface PurchaseLeadsKpiStripProps {
    kpis: CrmLeadKpis;
    statusFilter: PurchaseLeadsKpiFilter;
    onClearAll: () => void;
    onPickStatus: (status: PurchaseLeadsKpiFilter) => void;
}

export function PurchaseLeadsKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: PurchaseLeadsKpiStripProps) {
    const conversionLabel = `${(kpis.conversionRate ?? 0).toFixed(1)}%`;

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Total leads"
                value={kpis.total.toLocaleString()}
                icon={<Target className="h-4 w-4" />}
                active={statusFilter === 'all'}
                onClick={onClearAll}
            />
            <KpiCard
                label="Qualified"
                value={kpis.qualifiedCount.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
                active={statusFilter === 'qualified'}
                onClick={() => onPickStatus('qualified')}
            />
            <KpiCard
                label="Won"
                value={kpis.wonCount.toLocaleString()}
                icon={<Trophy className="h-4 w-4" />}
                active={statusFilter === 'won'}
                onClick={() => onPickStatus('won')}
            />
            <KpiCard
                label="Conversion rate"
                value={conversionLabel}
                icon={<Percent className="h-4 w-4" />}
                active={false}
                onClick={onClearAll}
            />
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

function KpiCard({ label, value, icon, active, onClick }: KpiCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'w-full text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
                active ? 'rounded-[var(--st-radius-lg)] ring-1 ring-[var(--st-text)]' : '',
            ].join(' ')}
        >
            <StatCard label={label} value={value} icon={icon} />
        </button>
    );
}

export default PurchaseLeadsKpiStrip;
