'use client';

import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
/**
 * <VendorBidFilters> — collapsible filter row for the Vendor Bids list.
 *
 * Six filters per CRM_REBUILD_PLAN §1D:
 *   status · linked RFQ · vendor · submitted-from · submitted-to ·
 *   lead-time bucket.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

const LEAD_TIME_OPTIONS = [
  { value: 'all', label: 'Any lead time' },
  { value: '0-7', label: '0–7 days' },
  { value: '8-30', label: '8–30 days' },
  { value: '31-60', label: '31–60 days' },
  { value: '61+', label: '61+ days' },
];

interface VendorBidFiltersProps {
  statusFilter: string;
  rfqIdFilter: string;
  vendorIdFilter: string | null;
  submittedFrom: string;
  submittedTo: string;
  leadTimeFilter: string;
  filtersActive: boolean;
  onStatusChange: (next: string) => void;
  onRfqIdChange: (next: string) => void;
  onVendorIdChange: (next: string | null) => void;
  onSubmittedFromChange: (next: string) => void;
  onSubmittedToChange: (next: string) => void;
  onLeadTimeChange: (next: string) => void;
  onClear: () => void;
}

export function VendorBidFilters(props: VendorBidFiltersProps) {
  const {
    statusFilter,
    rfqIdFilter,
    vendorIdFilter,
    submittedFrom,
    submittedTo,
    leadTimeFilter,
    filtersActive,
    onStatusChange,
    onRfqIdChange,
    onVendorIdChange,
    onSubmittedFromChange,
    onSubmittedToChange,
    onLeadTimeChange,
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
          <EnumFilterField
            enumName="vendorBidStatus"
            value={statusFilter}
            onChange={onStatusChange}
            allLabel="All statuses"
          />
        </div>

        <div className="space-y-1">
          <Label>Linked RFQ</Label>
          <EntityFormField
            entity="rfq"
            name="_filter_rfq"
            initialId={rfqIdFilter || null}
            onChange={(id) => onRfqIdChange(id ?? '')}
            placeholder="Any RFQ"
          />
        </div>

        <div className="space-y-1">
          <Label>Vendor</Label>
          <EntityFormField
            entity="vendor"
            name="_filter_vendor"
            initialId={vendorIdFilter}
            onChange={onVendorIdChange}
          />
        </div>

        <div className="space-y-1">
          <Label>Lead time</Label>
          <Select value={leadTimeFilter} onValueChange={onLeadTimeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_TIME_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Submitted — from</Label>
          <Input
            type="date"
            value={submittedFrom}
            onChange={(e) => onSubmittedFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Submitted — to</Label>
          <Input
            type="date"
            value={submittedTo}
            onChange={(e) => onSubmittedToChange(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
