'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruDateRangePicker,
} from '@/components/zoruui';
import {
  X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

/**
 * Filters row for Payouts. Per §1D.1:
 *
 *   Saved-view presets (chips) · Status · Vendor · Mode · Bank account
 *   · Date range · Clear-all.
 *
 * Saved-view presets pinned at the top: All · This month · Failed ·
 * Pending clearance.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import type { PayoutKpiFilter } from './payout-kpi-strip';

export type PayoutListPreset = 'all' | 'this_month' | 'failed' | 'pending_clearance';

const PRESETS: Array<{ value: PayoutListPreset; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'this_month', label: 'This month' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending_clearance', label: 'Pending clearance' },
];

interface PayoutFiltersRowProps {
    statusFilter: PayoutKpiFilter;
    onStatusChange: (v: PayoutKpiFilter) => void;
    vendorFilter: string;
    onVendorChange: (v: string) => void;
    modeFilter: string;
    onModeChange: (v: string) => void;
    bankFilter: string;
    onBankChange: (v: string) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (r: DateRange | undefined) => void;
    activePreset: PayoutListPreset;
    onSelectPreset: (preset: PayoutListPreset) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function PayoutFiltersRow(props: PayoutFiltersRowProps) {
    return (
        <div className="flex w-full flex-col gap-3">
            {/* Saved presets row */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
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
                                    ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-primary'
                                    : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink',
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
                    <EnumFilterField
                        enumName="payoutStatus"
                        value={props.statusFilter}
                        onChange={(v) => props.onStatusChange(v as PayoutKpiFilter)}
                        placeholder="All statuses"
                    />
                </div>
                <div className="w-56">
                    <EntityFormField
                        entity="vendor"
                        name="__vendor_filter"
                        initialId={props.vendorFilter || null}
                        placeholder="All vendors"
                        onChange={(id) => props.onVendorChange(id ?? '')}
                    />
                </div>
                <div className="w-36">
                    <EnumFilterField
                        enumName="paymentMode"
                        value={props.modeFilter || 'all'}
                        onChange={(v) => props.onModeChange(v === 'all' ? '' : v)}
                        placeholder="All modes"
                    />
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
                    <ZoruButton variant="ghost" size="sm" onClick={props.onClear}>
                        <X className="h-3.5 w-3.5" /> Clear
                    </ZoruButton>
                ) : null}
                {props.hasActiveFilters ? (
                    <ZoruBadge variant="secondary">Filters active</ZoruBadge>
                ) : null}
            </div>
        </div>
    );
}
