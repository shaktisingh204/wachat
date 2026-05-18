'use client';

import { ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
/**
 * <RfqFilters> — collapsible filter row for the RFQs list.
 *
 * Six filters per CRM_REBUILD_PLAN §1D:
 *   status · owner · deadline range (from/to) · scope category ·
 *   vendors-invited count.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'cancelled', label: 'Cancelled' },
];

const VENDORS_INVITED_OPTIONS = [
  { value: 'all', label: 'Any invited count' },
  { value: 'none', label: '0 vendors' },
  { value: '1-2', label: '1–2 vendors' },
  { value: '3-5', label: '3–5 vendors' },
  { value: '6+', label: '6 or more' },
];

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Any scope' },
  { value: 'goods', label: 'Goods' },
  { value: 'services', label: 'Services' },
  { value: 'capex', label: 'CapEx' },
  { value: 'other', label: 'Other' },
];

interface RfqFiltersProps {
  statusFilter: string;
  ownerFilter: string | null;
  scopeFilter: string;
  vendorsInvitedFilter: string;
  deadlineFrom: string;
  deadlineTo: string;
  filtersActive: boolean;
  onStatusChange: (next: string) => void;
  onOwnerChange: (next: string | null) => void;
  onScopeChange: (next: string) => void;
  onVendorsInvitedChange: (next: string) => void;
  onDeadlineFromChange: (next: string) => void;
  onDeadlineToChange: (next: string) => void;
  onClear: () => void;
}

export function RfqFilters(props: RfqFiltersProps) {
  const {
    statusFilter,
    ownerFilter,
    scopeFilter,
    vendorsInvitedFilter,
    deadlineFrom,
    deadlineTo,
    filtersActive,
    onStatusChange,
    onOwnerChange,
    onScopeChange,
    onVendorsInvitedChange,
    onDeadlineFromChange,
    onDeadlineToChange,
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
          <ZoruLabel>Owner</ZoruLabel>
          <EntityFormField
            entity="user"
            name="_filter_owner"
            initialId={ownerFilter}
            onChange={onOwnerChange}
          />
        </div>

        <div className="space-y-1">
          <ZoruLabel>Scope category</ZoruLabel>
          <ZoruSelect value={scopeFilter} onValueChange={onScopeChange}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {SCOPE_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>

        <div className="space-y-1">
          <ZoruLabel>Vendors invited</ZoruLabel>
          <ZoruSelect
            value={vendorsInvitedFilter}
            onValueChange={onVendorsInvitedChange}
          >
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {VENDORS_INVITED_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>

        <div className="space-y-1">
          <ZoruLabel>Deadline — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={deadlineFrom}
            onChange={(e) => onDeadlineFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Deadline — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={deadlineTo}
            onChange={(e) => onDeadlineToChange(e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}
