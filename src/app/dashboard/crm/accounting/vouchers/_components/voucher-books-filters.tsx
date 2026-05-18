'use client';

import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import * as React from 'react';

import { VOUCHER_TYPES, type VoucherBookType } from './types';

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
            <ZoruSelect
                value={value.type}
                onValueChange={(v) => onChange({ ...value, type: v as VoucherBookFilterState['type'] })}
            >
                <ZoruSelectTrigger className="h-9 w-[180px]">
                    <ZoruSelectValue placeholder="Type" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All types</ZoruSelectItem>
                    {VOUCHER_TYPES.map((t) => (
                        <ZoruSelectItem key={t} value={t}>
                            {t}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
                value={value.status}
                onValueChange={(v) => onChange({ ...value, status: v as VoucherBookFilterState['status'] })}
            >
                <ZoruSelectTrigger className="h-9 w-[140px]">
                    <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All status</ZoruSelectItem>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
                value={value.defaultOnly}
                onValueChange={(v) => onChange({ ...value, defaultOnly: v as VoucherBookFilterState['defaultOnly'] })}
            >
                <ZoruSelectTrigger className="h-9 w-[140px]">
                    <ZoruSelectValue placeholder="Default" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">Any default</ZoruSelectItem>
                    <ZoruSelectItem value="yes">Default only</ZoruSelectItem>
                    <ZoruSelectItem value="no">Non-default</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
                value={value.approval}
                onValueChange={(v) => onChange({ ...value, approval: v as VoucherBookFilterState['approval'] })}
            >
                <ZoruSelectTrigger className="h-9 w-[170px]">
                    <ZoruSelectValue placeholder="Approval" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">Any approval flag</ZoruSelectItem>
                    <ZoruSelectItem value="yes">Approval required</ZoruSelectItem>
                    <ZoruSelectItem value="no">Approval not required</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
        </div>
    );
}
