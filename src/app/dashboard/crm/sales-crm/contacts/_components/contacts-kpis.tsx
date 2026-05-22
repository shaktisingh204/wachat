'use client';

import { StatCard } from '@/components/zoruui';
import { CheckCircle2, Crown, Star, UserPlus, Users, } from 'lucide-react';

/**
 * KPI strip for the contacts list (extracted to keep `page.tsx` under
 * the 600-line scope cap). Each card toggles a status / lifecycle
 * filter when clicked.
 */

import * as React from 'react';

import type {
    ContactLifecycleFilter,
    ContactStatusFilter,
} from './contacts-filters';

export interface ContactKpis {
    total: number;
    newLeads: number;
    customers: number;
    mql: number;
    sql: number;
}

export const EMPTY_KPIS: ContactKpis = {
    total: 0,
    newLeads: 0,
    customers: 0,
    mql: 0,
    sql: 0,
};

interface ContactsKpiStripProps {
    kpis: ContactKpis;
    statusFilter: ContactStatusFilter;
    lifecycleFilter: ContactLifecycleFilter;
    hasActiveFilters: boolean;
    onClearAll: () => void;
    onSetStatus: (next: ContactStatusFilter) => void;
    onSetLifecycle: (next: ContactLifecycleFilter) => void;
}

export function ContactsKpiStrip({
    kpis,
    statusFilter,
    lifecycleFilter,
    hasActiveFilters,
    onClearAll,
    onSetStatus,
    onSetLifecycle,
}: ContactsKpiStripProps) {
    const card = (
        label: string,
        value: React.ReactNode,
        icon: React.ReactNode,
        active: boolean,
        onClick: () => void,
    ) => (
        <button
            type="button"
            onClick={onClick}
            className={[
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary',
                active
                    ? 'ring-1 ring-zoru-primary rounded-[var(--zoru-radius-lg)]'
                    : '',
            ].join(' ')}
        >
            <ZoruStatCard label={label} value={value} icon={icon} />
        </button>
    );

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {card(
                'Total contacts',
                kpis.total.toLocaleString(),
                <Users className="h-4 w-4" />,
                statusFilter === 'all' &&
                    lifecycleFilter === 'all' &&
                    !hasActiveFilters,
                onClearAll,
            )}
            {card(
                'New leads',
                kpis.newLeads.toLocaleString(),
                <UserPlus className="h-4 w-4" />,
                statusFilter === 'new_lead',
                () =>
                    onSetStatus(statusFilter === 'new_lead' ? 'all' : 'new_lead'),
            )}
            {card(
                'Customers',
                kpis.customers.toLocaleString(),
                <Crown className="h-4 w-4" />,
                statusFilter === 'customer',
                () =>
                    onSetStatus(statusFilter === 'customer' ? 'all' : 'customer'),
            )}
            {card(
                'MQL',
                kpis.mql.toLocaleString(),
                <Star className="h-4 w-4" />,
                lifecycleFilter === 'mql',
                () =>
                    onSetLifecycle(lifecycleFilter === 'mql' ? 'all' : 'mql'),
            )}
            {card(
                'SQL',
                kpis.sql.toLocaleString(),
                <CheckCircle2 className="h-4 w-4" />,
                lifecycleFilter === 'sql',
                () =>
                    onSetLifecycle(lifecycleFilter === 'sql' ? 'all' : 'sql'),
            )}
        </div>
    );
}
