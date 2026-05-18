'use client';

import { ZoruStatCard } from '@/components/zoruui';
import { Archive, Building2, Sparkles, Star, Users, } from 'lucide-react';

/**
 * KPI strip for the accounts list (§1D.1). Cards are clickable filter
 * toggles — clicking a card flips the matching category/status filter on
 * the parent list page.
 */

import * as React from 'react';

import type { AccountCategoryFilter, AccountStatusFilter } from './accounts-filters';

export interface AccountKpis {
    total: number;
    active: number;
    strategic: number;
    key: number;
    archived: number;
}

export const EMPTY_ACCOUNT_KPIS: AccountKpis = {
    total: 0,
    active: 0,
    strategic: 0,
    key: 0,
    archived: 0,
};

interface AccountsKpiStripProps {
    kpis: AccountKpis;
    statusFilter: AccountStatusFilter;
    categoryFilter: AccountCategoryFilter;
    hasActiveFilters: boolean;
    onClearAll: () => void;
    onSetStatus: (next: AccountStatusFilter) => void;
    onSetCategory: (next: AccountCategoryFilter) => void;
}

export function AccountsKpiStrip({
    kpis,
    statusFilter,
    categoryFilter,
    hasActiveFilters,
    onClearAll,
    onSetStatus,
    onSetCategory,
}: AccountsKpiStripProps) {
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
                'Total accounts',
                kpis.total.toLocaleString(),
                <Building2 className="h-4 w-4" />,
                statusFilter === 'all' &&
                    categoryFilter === 'all' &&
                    !hasActiveFilters,
                onClearAll,
            )}
            {card(
                'Active',
                kpis.active.toLocaleString(),
                <Users className="h-4 w-4" />,
                statusFilter === 'active',
                () =>
                    onSetStatus(statusFilter === 'active' ? 'all' : 'active'),
            )}
            {card(
                'Strategic',
                kpis.strategic.toLocaleString(),
                <Sparkles className="h-4 w-4" />,
                categoryFilter === 'strategic',
                () =>
                    onSetCategory(
                        categoryFilter === 'strategic' ? 'all' : 'strategic',
                    ),
            )}
            {card(
                'Key',
                kpis.key.toLocaleString(),
                <Star className="h-4 w-4" />,
                categoryFilter === 'key',
                () => onSetCategory(categoryFilter === 'key' ? 'all' : 'key'),
            )}
            {card(
                'Archived',
                kpis.archived.toLocaleString(),
                <Archive className="h-4 w-4" />,
                statusFilter === 'archived',
                () =>
                    onSetStatus(
                        statusFilter === 'archived' ? 'all' : 'archived',
                    ),
            )}
        </div>
    );
}
