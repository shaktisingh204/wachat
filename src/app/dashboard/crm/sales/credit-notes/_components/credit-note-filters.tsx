'use client';

import {
  Badge,
  Button,
  ZoruDateRangePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

/**
 * Filters row for Credit Notes per §1D.1.
 *
 *   Status · Customer · Reason · Refund mode · Date range · Clear-all
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

import type { CreditNoteKpiFilter } from './credit-note-kpi-strip';

const STATUSES: Array<{ value: CreditNoteKpiFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'pending', label: 'Pending' },
];

const REASONS: Array<{ value: string; label: string }> = [
    { value: 'return', label: 'Return' },
    { value: 'discount', label: 'Discount' },
    { value: 'price_adjust', label: 'Price adjustment' },
    { value: 'cancel', label: 'Cancellation' },
    { value: 'other', label: 'Other' },
];

const REFUND_MODES: Array<{ value: string; label: string }> = [
    { value: 'cash', label: 'Cash / bank' },
    { value: 'credit', label: 'Customer credit' },
    { value: 'replacement', label: 'Replacement' },
];

interface CreditNoteFiltersRowProps {
    statusFilter: CreditNoteKpiFilter;
    onStatusChange: (v: CreditNoteKpiFilter) => void;
    clientFilter: string;
    onClientChange: (v: string) => void;
    reasonFilter: string;
    onReasonChange: (v: string) => void;
    refundModeFilter: string;
    onRefundModeChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function CreditNoteFiltersRow(props: CreditNoteFiltersRowProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
                {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                <Select
                    value={props.statusFilter}
                    onValueChange={(v) => props.onStatusChange(v as CreditNoteKpiFilter)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                                {s.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-56">
                <EntityFormField
                    entity="client"
                    name="__cn_client_filter"
                    initialId={props.clientFilter || null}
                    placeholder="All customers"
                    onChange={(id) => props.onClientChange(id ?? '')}
                />
            </div>
            <div className="w-44">
                {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                <Select
                    value={props.reasonFilter || 'all'}
                    onValueChange={(v) => props.onReasonChange(v === 'all' ? '' : v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All reasons</SelectItem>
                        {REASONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-44">
                {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                <Select
                    value={props.refundModeFilter || 'all'}
                    onValueChange={(v) => props.onRefundModeChange(v === 'all' ? '' : v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Refund mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All modes</SelectItem>
                        {REFUND_MODES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-72">
                <ZoruDateRangePicker
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
