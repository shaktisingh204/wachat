'use client';

import { StatCard } from '@/components/sabcrm/20ui';
import {
  Archive,
  Building2,
  DollarSign,
  Layers,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

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
    totalArr: number;
    topIndustries: { industry: string; count: number }[];
}

export const EMPTY_ACCOUNT_KPIS: AccountKpis = {
    total: 0,
    active: 0,
    strategic: 0,
    key: 0,
    archived: 0,
    totalArr: 0,
    topIndustries: [],
};

function formatArr(n: number): string {
    if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`;
    if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

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
                'text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]',
                active
                    ? 'ring-1 ring-[var(--st-text)] rounded-[var(--st-radius-lg)]'
                    : '',
            ].join(' ')}
        >
            <StatCard label={label} value={value} icon={icon} />
        </button>
    );

    const topIndustriesValue = kpis.topIndustries.length === 0
        ? '—'
        : kpis.topIndustries
              .slice(0, 3)
              .map((t) => `${t.industry} (${t.count})`)
              .join(', ');

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
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
                'Total ARR',
                formatArr(kpis.totalArr),
                <DollarSign className="h-4 w-4" />,
                false,
                () => undefined,
            )}
            {card(
                'Top industries',
                <span className="text-[13px] font-medium leading-tight">
                    {topIndustriesValue}
                </span>,
                <Layers className="h-4 w-4" />,
                false,
                () => undefined,
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
