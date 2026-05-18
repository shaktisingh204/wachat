'use client';

import { ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
/**
 * <InvoicesFilters> — collapsible filter row for the invoices list.
 *
 * Eight dimensions: status (with synthetic "overdue"), customer, sales
 * agent, branch, currency, invoice date range, due date range, amount
 * range. Pure presentational — parent owns state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoicesFiltersProps {
  filtersActive: boolean;
  onClearAll: () => void;
  statusFilter: string;
  onStatusFilter: (next: string) => void;
  customerFilter: string | null;
  onCustomerFilter: (next: string | null) => void;
  agentFilter: string | null;
  onAgentFilter: (next: string | null) => void;
  branchFilter: string | null;
  onBranchFilter: (next: string | null) => void;
  currencyFilter: string | null;
  onCurrencyFilter: (next: string | null) => void;
  fromDate: string;
  onFromDate: (v: string) => void;
  toDate: string;
  onToDate: (v: string) => void;
  dueFrom: string;
  onDueFrom: (v: string) => void;
  dueTo: string;
  onDueTo: (v: string) => void;
  amountMin: string;
  onAmountMin: (v: string) => void;
  amountMax: string;
  onAmountMax: (v: string) => void;
}

export function InvoicesFilters({
  filtersActive,
  onClearAll,
  statusFilter,
  onStatusFilter,
  customerFilter,
  onCustomerFilter,
  agentFilter,
  onAgentFilter,
  branchFilter,
  onBranchFilter,
  currencyFilter,
  onCurrencyFilter,
  fromDate,
  onFromDate,
  toDate,
  onToDate,
  dueFrom,
  onDueFrom,
  dueTo,
  onDueTo,
  amountMin,
  onAmountMin,
  amountMax,
  onAmountMax,
}: InvoicesFiltersProps) {
  return (
    <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        Filters{' '}
        {filtersActive ? (
          <>
            <span className="ml-2 text-zoru-ink">·</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onClearAll();
              }}
              className="ml-1 text-zoru-primary hover:underline"
            >
              clear all
            </button>
          </>
        ) : null}
      </summary>
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <ZoruLabel>Status</ZoruLabel>
          {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
          <ZoruSelect value={statusFilter} onValueChange={onStatusFilter}>
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
            onChange={onCustomerFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Sales agent</ZoruLabel>
          <EntityFormField
            entity="user"
            name="_filter_agent"
            initialId={agentFilter}
            onChange={onAgentFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Branch</ZoruLabel>
          <EntityFormField
            entity="branch"
            name="_filter_branch"
            initialId={branchFilter}
            onChange={onBranchFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Currency</ZoruLabel>
          <EntityFormField
            entity="currency"
            name="_filter_currency"
            initialId={currencyFilter}
            onChange={onCurrencyFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Invoice date — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={fromDate}
            onChange={(e) => onFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Invoice date — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={toDate}
            onChange={(e) => onToDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Due — from</ZoruLabel>
          <ZoruInput
            type="date"
            value={dueFrom}
            onChange={(e) => onDueFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Due — to</ZoruLabel>
          <ZoruInput
            type="date"
            value={dueTo}
            onChange={(e) => onDueTo(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Amount min</ZoruLabel>
          <ZoruInput
            type="number"
            value={amountMin}
            onChange={(e) => onAmountMin(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Amount max</ZoruLabel>
          <ZoruInput
            type="number"
            value={amountMax}
            onChange={(e) => onAmountMax(e.target.value)}
            placeholder="∞"
          />
        </div>
      </div>
    </details>
  );
}
