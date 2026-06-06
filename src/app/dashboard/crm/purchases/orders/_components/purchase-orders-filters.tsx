'use client';

import { Input, Label } from '@/components/sabcrm/20ui/compat';
/**
 * <PurchaseOrdersFilters> — collapsible filter row for the PO list.
 *
 * Eight dimensions: status, vendor, owner (buyer), date range,
 * expected-delivery range, amount range, branch, approval-status.
 * Pure presentational — parent owns state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

interface PurchaseOrdersFiltersProps {
  filtersActive: boolean;
  onClearAll: () => void;
  statusFilter: string;
  onStatusFilter: (next: string) => void;
  vendorFilter: string | null;
  onVendorFilter: (next: string | null) => void;
  buyerFilter: string | null;
  onBuyerFilter: (next: string | null) => void;
  branchFilter: string | null;
  onBranchFilter: (next: string | null) => void;
  approvalFilter: string;
  onApprovalFilter: (next: string) => void;
  fromDate: string;
  onFromDate: (v: string) => void;
  toDate: string;
  onToDate: (v: string) => void;
  expectedFrom: string;
  onExpectedFrom: (v: string) => void;
  expectedTo: string;
  onExpectedTo: (v: string) => void;
  amountMin: string;
  onAmountMin: (v: string) => void;
  amountMax: string;
  onAmountMax: (v: string) => void;
}

export function PurchaseOrdersFilters({
  filtersActive,
  onClearAll,
  statusFilter,
  onStatusFilter,
  vendorFilter,
  onVendorFilter,
  buyerFilter,
  onBuyerFilter,
  branchFilter,
  onBranchFilter,
  approvalFilter,
  onApprovalFilter,
  fromDate,
  onFromDate,
  toDate,
  onToDate,
  expectedFrom,
  onExpectedFrom,
  expectedTo,
  onExpectedTo,
  amountMin,
  onAmountMin,
  amountMax,
  onAmountMax,
}: PurchaseOrdersFiltersProps) {
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
          <Label>Status</Label>
          <EnumFilterField
            enumName="purchaseOrderStatus"
            value={statusFilter}
            onChange={onStatusFilter}
            allLabel="All statuses"
          />
        </div>
        <div className="space-y-1">
          <Label>Vendor</Label>
          <EntityFormField
            entity="vendor"
            name="_filter_vendor"
            initialId={vendorFilter}
            onChange={onVendorFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Buyer / Owner</Label>
          <EntityFormField
            entity="user"
            name="_filter_buyer"
            initialId={buyerFilter}
            onChange={onBuyerFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Branch</Label>
          <EntityFormField
            entity="branch"
            name="_filter_branch"
            initialId={branchFilter}
            onChange={onBranchFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Approval status</Label>
          <EnumFilterField
            enumName="approvalStatus"
            value={approvalFilter}
            onChange={onApprovalFilter}
            allLabel="Any approval"
          />
        </div>
        <div className="space-y-1">
          <Label>PO date — from</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>PO date — to</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => onToDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Expected delivery — from</Label>
          <Input
            type="date"
            value={expectedFrom}
            onChange={(e) => onExpectedFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Expected delivery — to</Label>
          <Input
            type="date"
            value={expectedTo}
            onChange={(e) => onExpectedTo(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Amount min</Label>
          <Input
            type="number"
            value={amountMin}
            onChange={(e) => onAmountMin(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <Label>Amount max</Label>
          <Input
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
