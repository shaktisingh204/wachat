'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import * as React from 'react';

import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { useAccountingStore } from '../../_components/accounting-store';
import type { CoaNature } from './types';

export interface CoaFilterState {
    nature: 'all' | CoaNature;
    subNature: string;
    groupId: string;
    currency: string;
    status: 'all' | 'Active' | 'Inactive';
}

export const COA_FILTER_DEFAULT: CoaFilterState = {
    nature: 'all',
    subNature: 'all',
    groupId: 'all',
    currency: 'all',
    status: 'all',
};

interface CoaFiltersProps {
    value: CoaFilterState;
    onChange: (next: CoaFilterState) => void;
    groups: { _id: string; name: string; type: string }[];
    /** Sub-natures derived from the rows currently visible. */
    subNatures: string[];
    currencies: string[];
}

export function CoaFilters({ value, onChange, groups, subNatures, currencies }: CoaFiltersProps) {
    const { standard, setStandard, fiscalYear, setFiscalYear } = useAccountingStore();
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const visibleGroups = value.nature === 'all'
        ? groups
        : groups.filter((g) => g.type === value.nature);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <EnumFilterField
                enumName="accountNature"
                value={value.nature}
                onChange={(v) => onChange({ ...value, nature: v as CoaFilterState['nature'], subNature: 'all', groupId: 'all' })}
                allLabel="All natures"
                placeholder="Nature"
            />

            <Select value={value.subNature} onValueChange={(v) => onChange({ ...value, subNature: v })}>
                <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Sub-nature" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All sub-natures</SelectItem>
                    {subNatures.map((s) => (
                        <SelectItem key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={value.groupId} onValueChange={(v) => onChange({ ...value, groupId: v })}>
                <SelectTrigger className="h-9 w-[200px]">
                    <SelectValue placeholder="Parent group" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {visibleGroups.map((g) => (
                        <SelectItem key={g._id} value={g._id}>
                            {g.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={value.currency} onValueChange={(v) => onChange({ ...value, currency: v })}>
                <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All currencies</SelectItem>
                    {currencies.map((c) => (
                        <SelectItem key={c} value={c}>
                            {c}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <EnumFilterField
                enumName="accountActiveStatus"
                value={value.status}
                onChange={(v) => onChange({ ...value, status: v as CoaFilterState['status'] })}
                allLabel="All statuses"
                placeholder="Status"
            />

            <div className="ml-auto flex items-center gap-2">
                {isMounted ? (
                    <>
                        <Select value={standard} onValueChange={(v: any) => setStandard(v)}>
                            <SelectTrigger className="h-9 w-[100px] border-dashed">
                                <SelectValue placeholder="Standard" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GAAP">GAAP</SelectItem>
                                <SelectItem value="IFRS">IFRS</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={fiscalYear} onValueChange={(v: any) => setFiscalYear(v)}>
                            <SelectTrigger className="h-9 w-[130px] border-dashed">
                                <SelectValue placeholder="Fiscal Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="current">Current FY</SelectItem>
                                <SelectItem value="previous">Previous FY</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </>
                ) : (
                    <>
                        <div className="h-9 w-[100px] animate-pulse rounded-md bg-[var(--st-bg-muted)]" />
                        <div className="h-9 w-[130px] animate-pulse rounded-md bg-[var(--st-bg-muted)]" />
                    </>
                )}
            </div>
        </div>
    );
}
