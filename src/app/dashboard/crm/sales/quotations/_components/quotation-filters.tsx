'use client';

import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
/**
 * <QuotationFilters> — collapsible filter row for the quotations list.
 *
 * Six filters per CRM_REBUILD_PLAN §1D:
 *   status · customer · sales agent · date range · valid-until range
 *   · currency.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

interface QuotationFiltersProps {
  statusFilter: string;
  customerFilter: string | null;
  salesAgentFilter: string | null;
  currencyFilter: string | null;
  fromDate: string;
  toDate: string;
  validFrom: string;
  validTo: string;
  filtersActive: boolean;
  onStatusChange: (next: string) => void;
  onCustomerChange: (next: string | null) => void;
  onSalesAgentChange: (next: string | null) => void;
  onCurrencyChange: (next: string | null) => void;
  onFromDateChange: (next: string) => void;
  onToDateChange: (next: string) => void;
  onValidFromChange: (next: string) => void;
  onValidToChange: (next: string) => void;
  onClear: () => void;
}

export function QuotationFilters(props: QuotationFiltersProps) {
  const {
    statusFilter,
    customerFilter,
    salesAgentFilter,
    currencyFilter,
    fromDate,
    toDate,
    validFrom,
    validTo,
    filtersActive,
    onStatusChange,
    onCustomerChange,
    onSalesAgentChange,
    onCurrencyChange,
    onFromDateChange,
    onToDateChange,
    onValidFromChange,
    onValidToChange,
    onClear,
  } = props;

  return (
    <details className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Filters{' '}
        {filtersActive ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="ml-2 text-[var(--st-text)] hover:underline"
          >
            clear all
          </button>
        ) : null}
      </summary>
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Status</Label>
          {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Customer</Label>
          <EntityFormField
            entity="client"
            name="_filter_customer"
            initialId={customerFilter}
            onChange={onCustomerChange}
          />
        </div>

        <div className="space-y-1">
          <Label>Sales agent</Label>
          <EntityFormField
            entity="user"
            name="_filter_sales_agent"
            initialId={salesAgentFilter}
            onChange={onSalesAgentChange}
          />
        </div>

        <div className="space-y-1">
          <Label>Currency</Label>
          <EntityFormField
            entity="currency"
            name="_filter_currency"
            initialId={currencyFilter}
            onChange={onCurrencyChange}
          />
        </div>

        <div className="space-y-1">
          <Label>Date — from</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Date — to</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label>Valid until — from</Label>
          <Input
            type="date"
            value={validFrom}
            onChange={(e) => onValidFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Valid until — to</Label>
          <Input
            type="date"
            value={validTo}
            onChange={(e) => onValidToChange(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
