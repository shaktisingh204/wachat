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
} from '@/components/sabcrm/20ui/compat';
import {
  X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

/**
 * Filters row for Payment Receipts. Per §1D.1:
 *
 *   Saved-view presets (chips) · Status · Customer · Mode · Bank account
 *   · Date range · Clear-all.
 *
 * Drives the parent's filter state — every field is controlled and
 * dispatches via the `onXChange` props. Saved-view presets pinned at
 * the top: All / This month / Bounced / Pending clearance.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

import type { ReceiptKpiFilter } from './receipt-kpi-strip';
import type { ReceiptListPreset } from './receipt-list-client';

const STATUSES: Array<{ value: ReceiptKpiFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'bounced', label: 'Bounced' },
];

const MODES: Array<{ value: string; label: string }> = [
    { value: '', label: 'All modes' },
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'upi', label: 'UPI' },
    { value: 'neft', label: 'NEFT' },
    { value: 'rtgs', label: 'RTGS' },
    { value: 'imps', label: 'IMPS' },
    { value: 'card', label: 'Card' },
    { value: 'wallet', label: 'Wallet' },
];

const PRESETS: Array<{ value: ReceiptListPreset; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'this_month', label: 'This month' },
    { value: 'bounced', label: 'Bounced' },
    { value: 'pending_clearance', label: 'Pending clearance' },
];

interface ReceiptFiltersRowProps {
    statusFilter: ReceiptKpiFilter;
    onStatusChange: (v: ReceiptKpiFilter) => void;
    clientFilter: string;
    onClientChange: (v: string) => void;
    modeFilter: string;
    onModeChange: (v: string) => void;
    bankFilter: string;
    onBankChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    activePreset: ReceiptListPreset;
    onSelectPreset: (preset: ReceiptListPreset) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function ReceiptFiltersRow(props: ReceiptFiltersRowProps) {
    return (
        <div className="flex w-full flex-col gap-3">
            {/* Saved presets row */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Views
                </span>
                {PRESETS.map((p) => {
                    const active = props.activePreset === p.value;
                    return (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => props.onSelectPreset(p.value)}
                            className={[
                                'rounded-full border px-2.5 py-1 text-[12px] transition',
                                active
                                    ? 'border-[var(--st-text)] bg-[var(--st-text)]/10 text-[var(--st-text)]'
                                    : 'border-[var(--st-border)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                            ].join(' ')}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                    {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                    <Select
                        value={props.statusFilter}
                        onValueChange={(v) => props.onStatusChange(v as ReceiptKpiFilter)}
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
                    </Select>
                </div>
                <div className="w-56">
                    <EntityFormField
                        entity="client"
                        name="__client_filter"
                        initialId={props.clientFilter || null}
                        placeholder="All customers"
                        onChange={(id) => props.onClientChange(id ?? '')}
                    />
                </div>
                <div className="w-36">
                    {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                    <Select
                        value={props.modeFilter || ''}
                        onValueChange={(v) => props.onModeChange(v === 'all' ? '' : v)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Mode" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All modes</ZoruSelectItem>
                            {MODES.filter((m) => m.value).map((m) => (
                                <ZoruSelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="w-56">
                    <EntityFormField
                        entity="bankAccount"
                        name="__bank_filter"
                        initialId={props.bankFilter || null}
                        placeholder="All bank accounts"
                        onChange={(id) => props.onBankChange(id ?? '')}
                    />
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
        </div>
    );
}
