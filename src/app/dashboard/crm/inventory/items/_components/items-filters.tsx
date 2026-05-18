'use client';

/**
 * <ItemsFilters> — collapsible filter row for the items list.
 *
 * Eight dimensions: status, category, brand, vendor, tax rate, type
 * (goods/service/bundle), unit, trackInventory bool.
 * Pure presentational — parent owns state.
 */

import * as React from 'react';

import {
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
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
          {/* TODO 1E.sweep: filter-with-all — needs <EnumFilterField> variant (sentinel 'all' + clearable) */}
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
          <ZoruLabel>Type</ZoruLabel>
          {/* TODO 1E.sweep: filter-with-all — needs <EnumFilterField> variant */}
          <ZoruSelect value={typeFilter} onValueChange={onTypeFilter}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TYPE_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <div className="space-y-1">
          <ZoruLabel>Category</ZoruLabel>
          <EntityFormField
            entity="category"
            name="_filter_category"
            initialId={categoryFilter}
            onChange={onCategoryFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Brand</ZoruLabel>
          <EntityFormField
            entity="brand"
            name="_filter_brand"
            initialId={brandFilter}
            onChange={onBrandFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Vendor</ZoruLabel>
          <EntityFormField
            entity="vendor"
            name="_filter_vendor"
            initialId={vendorFilter}
            onChange={onVendorFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Tax rate</ZoruLabel>
          <EntityFormField
            entity="taxRate"
            name="_filter_taxRate"
            initialId={taxRateFilter}
            onChange={onTaxRateFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Unit</ZoruLabel>
          <EntityFormField
            entity="unit"
            name="_filter_unit"
            initialId={unitFilter}
            onChange={onUnitFilter}
          />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Inventory tracking</ZoruLabel>
          {/* TODO 1E.sweep: filter-with-all — needs <EnumFilterField> variant */}
          <ZoruSelect value={trackFilter} onValueChange={onTrackFilter}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TRACK_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value} value={o.value}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      </div>
    </details>
  );
}
