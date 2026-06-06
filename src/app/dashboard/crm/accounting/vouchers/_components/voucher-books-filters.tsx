'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
import * as React from 'react';

import { EnumFilterField } from '@/components/crm/enum-filter-field';
import type { VoucherBookType } from './types';

export interface VoucherBookFilterState {
    type: 'all' | VoucherBookType;
    status: 'all' | 'active' | 'inactive';
    defaultOnly: 'all' | 'yes' | 'no';
    approval: 'all' | 'yes' | 'no';
}

export const VOUCHER_BOOK_FILTER_DEFAULT: VoucherBookFilterState = {
    type: 'all',
    status: 'all',
    defaultOnly: 'all',
    approval: 'all',
};

interface VoucherBooksFiltersProps {
    value: VoucherBookFilterState;
    onChange: (next: VoucherBookFilterState) => void;
}

export function VoucherBooksFilters({ value, onChange }: VoucherBooksFiltersProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <EnumFilterField
                enumName="voucherType"
                value={value.type}
                onChange={(v) => onChange({ ...value, type: v as VoucherBookFilterState['type'] })}
                allLabel="All types"
            />
            <Select
                value={value.status}
                onValueChange={(v) => onChange({ ...value, status: v as VoucherBookFilterState['status'] })}
            >
                <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.defaultOnly}
                onValueChange={(v) => onChange({ ...value, defaultOnly: v as VoucherBookFilterState['defaultOnly'] })}
            >
                <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any default</SelectItem>
                    <SelectItem value="yes">Default only</SelectItem>
                    <SelectItem value="no">Non-default</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.approval}
                onValueChange={(v) => onChange({ ...value, approval: v as VoucherBookFilterState['approval'] })}
            >
                <SelectTrigger className="h-9 w-[170px]">
                    <SelectValue placeholder="Approval" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any approval flag</SelectItem>
                    <SelectItem value="yes">Approval required</SelectItem>
                    <SelectItem value="no">Approval not required</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
