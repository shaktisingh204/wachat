'use client';

import { StatCard } from '@/components/sabcrm/20ui/compat';
import { FileMinus, BadgeDollarSign, Hourglass, Link2 } from 'lucide-react';

/**
 * KPI strip for the Credit Notes list page — 4 stat cards per §1D.1.
 *
 *   Total CNs · Refunded · Pending refund · Linked invoice value
 *
 * Each card is a clickable filter trigger.
 */

import * as React from 'react';

import type { CreditNoteKpis } from '@/app/actions/crm/credit-notes.actions.types';

export type CreditNoteKpiFilter = 'all' | 'refunded' | 'pending';

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

export interface CreditNoteKpiStripProps {
    kpis: CreditNoteKpis;
    statusFilter: CreditNoteKpiFilter;
    onClearAll: () => void;
    onPickStatus: (status: CreditNoteKpiFilter) => void;
}

export function CreditNoteKpiStrip({
    kpis,
    statusFilter,
    onClearAll,
    onPickStatus,
}: CreditNoteKpiStripProps) {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                label="Total CNs"
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
                label="Pending refund"
                value={kpis.pendingRefundCount.toLocaleString()}
                icon={<Hourglass className="h-4 w-4" />}
                active={statusFilter === 'pending'}
                onClick={() => onPickStatus('pending')}
            />
            <KpiCard
                label="Linked invoice value"
                value={fmtMoney(kpis.linkedInvoiceValue, kpis.currency)}
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
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
                active ? 'ring-1 ring-[var(--st-text)] rounded-[var(--zoru-radius-lg)]' : '',
            ].join(' ')}
        >
            <StatCard label={label} value={value} icon={icon} />
        </button>
    );
}

export default CreditNoteKpiStrip;
