'use client';

import { StatCard } from '@/components/zoruui';
import { Banknote, CheckCircle2, XCircle, Hourglass } from 'lucide-react';

/**
 * KPI strip for the Payouts list page — 4 stat cards per §1D.1.
 *
 *   Paid this month · Cleared · Failed · Pending
 *
 * Buy-side mirror of `<ReceiptKpiStrip>` — each card is clickable and
 * applies a status filter (or for "Paid this month", clears all
 * filters).
 */

import * as React from 'react';

import type { PayoutKpis } from '@/app/actions/crm/payouts.actions';

export type PayoutKpiFilter = 'all' | 'cleared' | 'failed' | 'pending';

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

export interface PayoutKpiStripProps {
    kpis: PayoutKpis;
    statusFilter: PayoutKpiFilter;
    onClearAll: () => void;
    onPickStatus: (status: PayoutKpiFilter) => void;
}

export function PayoutKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: PayoutKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Paid this month"
                value={fmtMoney(kpis.paidThisMonthTotal, kpis.currency)}
                sublabel={`${kpis.paidThisMonthCount} payout${
                    kpis.paidThisMonthCount === 1 ? '' : 's'
                }`}
                icon={<Banknote className="h-4 w-4" />}
                active={statusFilter === 'all'}
                onClick={onClearAll}
            />
            <KpiCard
                label="Cleared"
                value={kpis.clearedCount.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
                active={statusFilter === 'cleared'}
                onClick={() => onPickStatus('cleared')}
            />
            <KpiCard
                label="Failed"
                value={kpis.failedCount.toLocaleString()}
                icon={<XCircle className="h-4 w-4" />}
                active={statusFilter === 'failed'}
                onClick={() => onPickStatus('failed')}
            />
            <KpiCard
                label="Pending"
                value={kpis.pendingCount.toLocaleString()}
                icon={<Hourglass className="h-4 w-4" />}
                active={statusFilter === 'pending'}
                onClick={() => onPickStatus('pending')}
            />
        </div>
    );
}

function KpiCard({
    label,
    value,
    sublabel,
    icon,
    active,
    onClick,
}: {
    label: string;
    value: React.ReactNode;
    sublabel?: string;
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
            <StatCard label={label} value={value} icon={icon} period={sublabel} />
        </button>
    );
}

export default PayoutKpiStrip;
