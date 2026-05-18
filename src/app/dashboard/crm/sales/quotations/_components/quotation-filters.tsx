'use client';

import { ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
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
    <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        Filters{' '}
        {filtersActive ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="ml-2 text-zoru-primary hover:underline"
          >
            clear all
          </button>
        ) : null}
      </summary>
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <ZoruLabel>Status</ZoruLabel>
          <ZoruSelect value={statusFilter} onValueChange={onStatusChange}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {STATUS_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>

        <div className="space-y-1">
          <ZoruLabel>Customer</ZoruLabel>
          <EntityFormField
            entity="client"
            name="_filter_customer"
            initialId={customerFilter}
            onChange={onCustomerChange}
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Sales agent</ZoruLabel>
          <EntityFormField
            entity="user"
            name="_filter_sales_agent"
            initialId={salesAgentFilter}
            onChange={onSalesAgentChange}
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Currency</ZoruLabel>
          <EntityFormField
            entity="currency"
            name="_filter_currency"
            initialId={currencyFilter}
            onChange={onCurrencyChange}
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Date — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Date — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Valid until — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={validFrom}
            onChange={(e) => onValidFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Valid until — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={validTo}
            onChange={(e) => onValidToChange(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
