'use client';

import { ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
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
          <EnumFilterField
            enumName="vendorBidStatus"
            value={statusFilter}
            onChange={onStatusChange}
            allLabel="All statuses"
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Linked RFQ</ZoruLabel>
          <EntityFormField
            entity="rfq"
            name="_filter_rfq"
            initialId={rfqIdFilter || null}
            onChange={(id) => onRfqIdChange(id ?? '')}
            placeholder="Any RFQ"
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Vendor</ZoruLabel>
          <EntityFormField
            entity="vendor"
            name="_filter_vendor"
            initialId={vendorIdFilter}
            onChange={onVendorIdChange}
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Lead time</ZoruLabel>
          <ZoruSelect value={leadTimeFilter} onValueChange={onLeadTimeChange}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {LEAD_TIME_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>

        <div className="space-y-1">
          <ZoruLabel>Submitted — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={submittedFrom}
            onChange={(e) => onSubmittedFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Submitted — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={submittedTo}
            onChange={(e) => onSubmittedToChange(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
