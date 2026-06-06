'use client';

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
/**
 * <ItemsFilters> — collapsible filter row for the items list.
 *
 * Eight dimensions: status, category, brand, vendor, tax rate, type
 * (goods/service/bundle), unit, trackInventory bool.
 * Pure presentational — parent owns state.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'goods', label: 'Goods' },
  { value: 'service', label: 'Service' },
  { value: 'bundle', label: 'Bundle' },
];

const TRACK_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'tracked', label: 'Tracked' },
  { value: 'untracked', label: 'Not tracked' },
];

interface ItemsFiltersProps {
  filtersActive: boolean;
  onClearAll: () => void;
  statusFilter: string;
  onStatusFilter: (next: string) => void;
  categoryFilter: string | null;
  onCategoryFilter: (next: string | null) => void;
  brandFilter: string | null;
  onBrandFilter: (next: string | null) => void;
  vendorFilter: string | null;
  onVendorFilter: (next: string | null) => void;
  taxRateFilter: string | null;
  onTaxRateFilter: (next: string | null) => void;
  typeFilter: string;
  onTypeFilter: (next: string) => void;
  unitFilter: string | null;
  onUnitFilter: (next: string | null) => void;
  trackFilter: string;
  onTrackFilter: (next: string) => void;
}

export function ItemsFilters({
  filtersActive,
  onClearAll,
  statusFilter,
  onStatusFilter,
  categoryFilter,
  onCategoryFilter,
  brandFilter,
  onBrandFilter,
  vendorFilter,
  onVendorFilter,
  taxRateFilter,
  onTaxRateFilter,
  typeFilter,
  onTypeFilter,
  unitFilter,
  onUnitFilter,
  trackFilter,
  onTrackFilter,
}: ItemsFiltersProps) {
  return (
    <details className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/40" open>
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Filters{' '}
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
      <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Status</Label>
          {/* TODO 1E.sweep: filter-with-all — needs <EnumFilterField> variant (sentinel 'all' + clearable) */}
          <Select value={statusFilter} onValueChange={onStatusFilter}>
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
          <Label>Type</Label>
          {/* TODO 1E.sweep: filter-with-all — needs <EnumFilterField> variant */}
          <Select value={typeFilter} onValueChange={onTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <EntityFormField
            entity="category"
            name="_filter_category"
            initialId={categoryFilter}
            onChange={onCategoryFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Brand</Label>
          <EntityFormField
            entity="brand"
            name="_filter_brand"
            initialId={brandFilter}
            onChange={onBrandFilter}
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
          <Label>Tax rate</Label>
          <EntityFormField
            entity="taxRate"
            name="_filter_taxRate"
            initialId={taxRateFilter}
            onChange={onTaxRateFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Unit</Label>
          <EntityFormField
            entity="unit"
            name="_filter_unit"
            initialId={unitFilter}
            onChange={onUnitFilter}
          />
        </div>
        <div className="space-y-1">
          <Label>Inventory tracking</Label>
          {/* TODO 1E.sweep: filter-with-all — needs <EnumFilterField> variant */}
          <Select value={trackFilter} onValueChange={onTrackFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRACK_OPTIONS.map((o) => (
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
