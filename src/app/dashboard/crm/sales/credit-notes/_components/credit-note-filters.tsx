'use client';

import {
  Badge,
  Button,
  ZoruDateRangePicker,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
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
                <ZoruSelect
                    value={props.statusFilter}
                    onValueChange={(v) => props.onStatusChange(v as CreditNoteKpiFilter)}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Status" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {STATUSES.map((s) => (
                            <ZoruSelectItem key={s.value} value={s.value}>
                                {s.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
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
                <ZoruSelect
                    value={props.reasonFilter || 'all'}
                    onValueChange={(v) => props.onReasonChange(v === 'all' ? '' : v)}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Reason" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All reasons</ZoruSelectItem>
                        {REASONS.map((r) => (
                            <ZoruSelectItem key={r.value} value={r.value}>
                                {r.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
            <div className="w-44">
                {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                <ZoruSelect
                    value={props.refundModeFilter || 'all'}
                    onValueChange={(v) => props.onRefundModeChange(v === 'all' ? '' : v)}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Refund mode" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All modes</ZoruSelectItem>
                        {REFUND_MODES.map((r) => (
                            <ZoruSelectItem key={r.value} value={r.value}>
                                {r.label}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
            <div className="w-72">
                <ZoruDateRangePicker
                    value={props.dateRange}
                    onChange={(r) => props.onDateRangeChange(r)}
                />
            </div>
            {props.hasActiveFilters ? (
                <ZoruButton variant="ghost" size="sm" onClick={props.onClear}>
                    <X className="h-3.5 w-3.5" /> Clear
                </ZoruButton>
            ) : null}
            {props.hasActiveFilters ? (
                <ZoruBadge variant="secondary">Filters active</ZoruBadge>
            ) : null}
        </div>
    );
}
