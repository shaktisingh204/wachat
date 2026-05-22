'use client';

import { StatCard } from '@/components/zoruui';
import { FileMinus, BadgeDollarSign, Hourglass, Link2 } from 'lucide-react';

/**
 * KPI strip for the Debit Notes list page — 4 stat cards per §1D.1.
 *
 *   Total DNs · Refunded · Pending · Linked bill value
 *
 * Buy-side mirror of `<CreditNoteKpiStrip>`.
 */

import * as React from 'react';

import type { DebitNoteKpis } from '@/app/actions/crm/debit-notes.actions';

export type DebitNoteKpiFilter = 'all' | 'refunded' | 'pending';

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

export interface DebitNoteKpiStripProps {
    kpis: DebitNoteKpis;
    statusFilter: DebitNoteKpiFilter;
    onClearAll: () => void;
    onPickStatus: (status: DebitNoteKpiFilter) => void;
}

export function DebitNoteKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: DebitNoteKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Total DNs"
                value={kpis.totalCount.toLocaleString()}
                icon={<FileMinus className="h-4 w-4" />}
                active={statusFilter === 'all'}
                onClick={onClearAll}
            />
            <KpiCard
                label="Refunded"
                value={kpis.refundedCount.toLocaleString()}
                icon={<BadgeDollarSign className="h-4 w-4" />}
                active={statusFilter === 'refunded'}
                onClick={() => onPickStatus('refunded')}
            />
            <KpiCard
                label="Pending"
                value={kpis.pendingRefundCount.toLocaleString()}
                icon={<Hourglass className="h-4 w-4" />}
                active={statusFilter === 'pending'}
                onClick={() => onPickStatus('pending')}
            />
            <KpiCard
                label="Linked bill value"
                value={fmtMoney(kpis.linkedBillValue, kpis.currency)}
                icon={<Link2 className="h-4 w-4" />}
                active={false}
                onClick={onClearAll}
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

export default DebitNoteKpiStrip;
