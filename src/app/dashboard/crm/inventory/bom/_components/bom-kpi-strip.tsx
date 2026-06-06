'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { Boxes, GitBranch, IndianRupee, Layers } from 'lucide-react';

/**
 * KPI strip for the BOM list — 4 stat cards required by §1D.
 */

import * as React from 'react';

import type { CrmBomKpis } from '@/app/actions/crm-bom.actions.types';

export interface BomKpiStripProps {
    kpis: CrmBomKpis;
    activeFilter: 'all' | 'active' | 'archived';
    onPickActive: () => void;
    onClear: () => void;
}

function formatMoney(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `INR ${value}`;
    }
}

export function BomKpiStrip({ kpis, activeFilter, onPickActive, onClear }: BomKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Active BOMs"
                value={kpis.active.toLocaleString()}
                icon={<Layers className="h-4 w-4" />}
                active={activeFilter === 'active'}
                onClick={onPickActive}
            />
            <KpiCard
                label="Finished goods covered"
                value={kpis.finishedGoodsCovered.toLocaleString()}
                icon={<Boxes className="h-4 w-4" />}
                active={false}
                onClick={onClear}
            />
            <KpiCard
                label="Avg cost per BOM"
                value={formatMoney(kpis.avgCost)}
                icon={<IndianRupee className="h-4 w-4" />}
                active={false}
                onClick={onClear}
            />
            <KpiCard
                label="Versions"
                value={kpis.versionsCount.toLocaleString()}
                icon={<GitBranch className="h-4 w-4" />}
                active={false}
                onClick={onClear}
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
                active ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]' : '',
            ].join(' ')}
        >
            <StatCard label={label} value={value} icon={icon} />
        </button>
    );
}

export default BomKpiStrip;
