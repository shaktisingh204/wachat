'use client';

import { Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import * as React from 'react';

import { EnumFilterField } from '@/components/crm/enum-filter-field';
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
            <EnumFilterField
                enumName="accountNature"
                value={value.nature}
                onChange={(v) => onChange({ ...value, nature: v as CoaFilterState['nature'], subNature: 'all', groupId: 'all' })}
                allLabel="All natures"
                placeholder="Nature"
            />

            <Select value={value.subNature} onValueChange={(v) => onChange({ ...value, subNature: v })}>
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
            </Select>

            <Select value={value.groupId} onValueChange={(v) => onChange({ ...value, groupId: v })}>
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
            </Select>

            <Select value={value.currency} onValueChange={(v) => onChange({ ...value, currency: v })}>
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
            </Select>

            <EnumFilterField
                enumName="accountActiveStatus"
                value={value.status}
                onChange={(v) => onChange({ ...value, status: v as CoaFilterState['status'] })}
                allLabel="All statuses"
                placeholder="Status"
            />
        </div>
    );
}
