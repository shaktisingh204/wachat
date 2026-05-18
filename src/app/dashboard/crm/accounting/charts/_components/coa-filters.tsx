'use client';

import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import * as React from 'react';

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
    const visibleGroups = value.nature === 'all'
        ? groups
        : groups.filter((g) => g.type === value.nature);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
                value={value.nature}
                onValueChange={(v) => onChange({ ...value, nature: v as CoaFilterState['nature'], subNature: 'all', groupId: 'all' })}
            >
                <ZoruSelectTrigger className="h-9 w-[150px]">
                    <ZoruSelectValue placeholder="Nature" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All natures</ZoruSelectItem>
                    <ZoruSelectItem value="Asset">Assets</ZoruSelectItem>
                    <ZoruSelectItem value="Liability">Liabilities</ZoruSelectItem>
                    <ZoruSelectItem value="Income">Income</ZoruSelectItem>
                    <ZoruSelectItem value="Expense">Expense</ZoruSelectItem>
                    <ZoruSelectItem value="Capital">Capital</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruSelect value={value.subNature} onValueChange={(v) => onChange({ ...value, subNature: v })}>
                <ZoruSelectTrigger className="h-9 w-[180px]">
                    <ZoruSelectValue placeholder="Sub-nature" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All sub-natures</ZoruSelectItem>
                    {subNatures.map((s) => (
                        <ZoruSelectItem key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruSelect value={value.groupId} onValueChange={(v) => onChange({ ...value, groupId: v })}>
                <ZoruSelectTrigger className="h-9 w-[200px]">
                    <ZoruSelectValue placeholder="Parent group" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All groups</ZoruSelectItem>
                    {visibleGroups.map((g) => (
                        <ZoruSelectItem key={g._id} value={g._id}>
                            {g.name}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruSelect value={value.currency} onValueChange={(v) => onChange({ ...value, currency: v })}>
                <ZoruSelectTrigger className="h-9 w-[130px]">
                    <ZoruSelectValue placeholder="Currency" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All currencies</ZoruSelectItem>
                    {currencies.map((c) => (
                        <ZoruSelectItem key={c} value={c}>
                            {c}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>

            <ZoruSelect
                value={value.status}
                onValueChange={(v) => onChange({ ...value, status: v as CoaFilterState['status'] })}
            >
                <ZoruSelectTrigger className="h-9 w-[130px]">
                    <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All status</ZoruSelectItem>
                    <ZoruSelectItem value="Active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="Inactive">Inactive</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
        </div>
    );
}
