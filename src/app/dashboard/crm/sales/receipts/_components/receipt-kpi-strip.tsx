'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import { Banknote, CheckCircle2, XCircle, Clock } from 'lucide-react';

/**
 * KPI strip for the Payment Receipts list page — 4 stat cards per §1D.1.
 *
 *   Received this month · Cleared · Bounced · Avg days to collect
 *
 * Each card is a button. Clicking applies a status filter (or for the
 * "Received this month" card, clears all filters and shows everything).
 */

import * as React from 'react';

import type { PaymentReceiptKpis } from '@/app/actions/crm/payment-receipts.actions.types';

export type ReceiptKpiFilter = 'all' | 'cleared' | 'bounced';

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

export interface ReceiptKpiStripProps {
    kpis: PaymentReceiptKpis;
    statusFilter: ReceiptKpiFilter;
    onClearAll: () => void;
    onPickStatus: (status: ReceiptKpiFilter) => void;
}

export function ReceiptKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: ReceiptKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Received this month"
                value={fmtMoney(kpis.receivedThisMonthTotal, kpis.currency)}
                sublabel={`${kpis.receivedThisMonthCount} receipt${
                    kpis.receivedThisMonthCount === 1 ? '' : 's'
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
                label="Bounced"
                value={kpis.bouncedCount.toLocaleString()}
                icon={<XCircle className="h-4 w-4" />}
                active={statusFilter === 'bounced'}
                onClick={() => onPickStatus('bounced')}
            />
            <KpiCard
                label="Avg days to collect"
                value={`${kpis.avgDaysToCollect}d`}
                icon={<Clock className="h-4 w-4" />}
                active={false}
                onClick={onClearAll}
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
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
                active ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]' : '',
            ].join(' ')}
        >
            <StatCard label={label} value={value} icon={icon} period={sublabel} />
        </button>
    );
}

export default ReceiptKpiStrip;
