'use client';

import * as React from 'react';
import { Building2, CheckCircle2, Crown, Wallet } from 'lucide-react';

import { StatCard } from '@/components/zoruui';

import type { CrmVendorKpis } from '@/app/actions/crm-vendors.actions';

/**
 * KPI strip for the Inventory · Vendors list page.
 *
 *   Total vendors · Active (last 12mo) · Total purchase value · Top vendor
 *
 * Cards are clickable wrappers around <ZoruStatCard /> so callers can wire
 * cross-filtering (e.g. click "Active" → status filter = active).
 */

function fmtMoney(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency || 'INR'} ${value}`;
    }
}

export type VendorsKpiFilter = 'all' | 'active' | 'inactive';

export interface VendorsKpiStripProps {
    kpis: CrmVendorKpis;
    statusFilter: VendorsKpiFilter;
    onClearAll: () => void;
    onPickStatus: (status: VendorsKpiFilter) => void;
}

export function VendorsKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: VendorsKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Total vendors"
                value={kpis.total.toLocaleString()}
                icon={<Building2 className="h-4 w-4" />}
                active={statusFilter === 'all'}
                onClick={onClearAll}
            />
            <KpiCard
                label="Active (12mo)"
                value={kpis.active.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
                active={statusFilter === 'active'}
                onClick={() => onPickStatus('active')}
            />
            <KpiCard
                label="Total purchase value"
                value={fmtMoney(kpis.totalPurchaseValue, kpis.currency)}
                icon={<Wallet className="h-4 w-4" />}
                active={false}
                onClick={onClearAll}
            />
            <KpiCard
                label="Top vendor"
                value={
                    kpis.topVendor ? (
                        <span className="block max-w-full truncate" title={kpis.topVendor.name}>
                            {kpis.topVendor.name}
                        </span>
                    ) : (
                        '—'
                    )
                }
                hint={
                    kpis.topVendor
                        ? fmtMoney(kpis.topVendor.value, kpis.currency)
                        : 'No purchase orders yet'
                }
                icon={<Crown className="h-4 w-4" />}
                active={false}
                onClick={onClearAll}
            />
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

function KpiCard({ label, value, hint, icon, active, onClick }: KpiCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'w-full text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
                active ? 'rounded-[var(--zoru-radius-lg)] ring-1 ring-zoru-primary' : '',
            ].join(' ')}
        >
            <ZoruStatCard
                label={label}
                value={value}
                icon={icon}
                period={hint}
            />
        </button>
    );
}

export default VendorsKpiStrip;
