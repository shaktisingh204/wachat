'use client';

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
/**
 * <SubscriptionFilters> — collapsible filter row for the §1D
 * subscriptions list.
 *
 * Dimensions: client (account picker), status (catalogued enum →
 * `<EnumFilterField enumName="subscriptionStatus">`), billing cadence
 * (frequency), renewal mode. Pure presentational — parent owns the
 * state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

const FREQUENCY_OPTIONS = [
  { value: 'all', label: 'All cadences' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

const RENEWAL_OPTIONS = [
  { value: 'all', label: 'Any renewal' },
  { value: 'auto', label: 'Auto-renew' },
  { value: 'manual', label: 'Manual' },
];

interface SubscriptionFiltersProps {
  filtersActive: boolean;
  onClearAll: () => void;
  /** `'all'` sentinel = no filter. Mirrors `<EnumFilterField>` semantics. */
  statusFilter: string;
  onStatusFilter: (next: string) => void;
  customerFilter: string | null;
  onCustomerFilter: (next: string | null) => void;
  frequencyFilter: string;
  onFrequencyFilter: (next: string) => void;
  renewalFilter: string;
  onRenewalFilter: (next: string) => void;
}

export function SubscriptionFilters({
  filtersActive,
  onClearAll,
  statusFilter,
  onStatusFilter,
  customerFilter,
  onCustomerFilter,
  frequencyFilter,
  onFrequencyFilter,
  renewalFilter,
  onRenewalFilter,
}: SubscriptionFiltersProps) {
  return (
    <details className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Filters
        {filtersActive ? (
          <>
            <span className="ml-2 text-[var(--st-text)]">·</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClearAll();
              }}
              className="ml-1 text-[var(--st-text)] hover:underline"
            >
              clear all
            </button>
          </>
        ) : null}
      </summary>
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Client</Label>
          <EntityFormField
            entity="client"
            name="_filter_customer"
            initialId={customerFilter}
            onChange={onCustomerFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <EnumFilterField
            enumName="subscriptionStatus"
            value={statusFilter}
            onChange={onStatusFilter}
            allLabel="All statuses"
          />
        </div>
        <div className="space-y-1">
          <Label>Billing cadence</Label>
          {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
          <Select value={frequencyFilter} onValueChange={onFrequencyFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Renewal</Label>
          {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
          <Select value={renewalFilter} onValueChange={onRenewalFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RENEWAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </details>
  );
}
