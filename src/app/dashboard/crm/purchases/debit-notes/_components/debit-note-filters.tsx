'use client';

import { Badge, Button, DateRangePicker } from '@/components/sabcrm/20ui';
import {
  X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

/**
 * Filters row for Debit Notes per §1D.1.
 *
 *   Status · Vendor · Reason · Refund mode · Date range · Clear-all
 *
 * Buy-side mirror of `<CreditNoteFiltersRow>`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import type { DebitNoteKpiFilter } from './debit-note-kpi-strip';


interface DebitNoteFiltersRowProps {
    statusFilter: DebitNoteKpiFilter;
    onStatusChange: (v: DebitNoteKpiFilter) => void;
    vendorFilter: string;
    onVendorChange: (v: string) => void;
    reasonFilter: string;
    onReasonChange: (v: string) => void;
    refundModeFilter: string;
    onRefundModeChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function DebitNoteFiltersRow(props: DebitNoteFiltersRowProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
                <EnumFilterField
                    enumName="debitNoteStatusV2"
                    value={props.statusFilter}
                    onChange={(v) => props.onStatusChange(v as DebitNoteKpiFilter)}
                    placeholder="All statuses"
                />
            </div>
            <div className="w-56">
                <EntityFormField
                    entity="vendor"
                    name="__dn_vendor_filter"
                    initialId={props.vendorFilter || null}
                    placeholder="All vendors"
                    onChange={(id) => props.onVendorChange(id ?? '')}
                />
            </div>
            <div className="w-44">
                <EnumFilterField
                    enumName="debitNoteReason"
                    value={props.reasonFilter || 'all'}
                    onChange={(v) => props.onReasonChange(v === 'all' ? '' : v)}
                    placeholder="All reasons"
                />
            </div>
            <div className="w-44">
                <EnumFilterField
                    enumName="debitNoteRefundMode"
                    value={props.refundModeFilter || 'all'}
                    onChange={(v) => props.onRefundModeChange(v === 'all' ? '' : v)}
                    placeholder="All modes"
                />
            </div>
            <div className="w-72">
                <DateRangePicker
                    value={props.dateRange}
                    onChange={(r) => props.onDateRangeChange(r)}
                />
            </div>
            {props.hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={props.onClear}>
                    <X className="h-3.5 w-3.5" /> Clear
                </Button>
            ) : null}
            {props.hasActiveFilters ? (
                <Badge variant="secondary">Filters active</Badge>
            ) : null}
        </div>
    );
}
