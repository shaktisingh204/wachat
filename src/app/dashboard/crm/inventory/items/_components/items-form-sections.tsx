'use client';

import { Button, Checkbox, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Section primitives for the canonical Item form — part 1.
 *
 * Covers: Basic · Description · Pricing · Purchase · Inventory. The
 * remaining sections (Images, Dimensions, Accounting, Meta) live in
 * `items-form-sections-extra.tsx` so each file stays under the 600-line
 * cap.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityMultiFormField } from '@/components/crm/entity-multi-form-field';

import { BoolToggle, Field, SectionCard } from './items-form-primitives';
import type { OpeningStockRow, SpecRow } from './use-item-form';

/* ─── Section: Basic ─────────────────────────────────────────────────── */

interface BasicSectionProps {
  itemType: string;
  onItemType: (v: string) => void;
  defaultName?: string;
  defaultSku?: string;
  defaultBarcode?: string;
  variantOfId: string | null;
  onVariantOf: (v: string | null) => void;
  defaultHsnSac?: string;
  defaultGstRate?: number | '';
  defaultCess?: number | '';
  unitId: string | null;
  onUnitId: (v: string | null) => void;
  altUnitIds: string[];
  onAltUnitIds: (ids: string[]) => void;
  defaultSubUnit?: string;
  brandId: string | null;
  onBrandId: (v: string | null) => void;
  categoryIds: string[];
  onCategoryIds: (ids: string[]) => void;
  defaultManufacturer?: string;
  defaultMpn?: string;
  defaultCountryOfOrigin?: string;
}

export function BasicSection(props: BasicSectionProps) {
  return (
    <SectionCard title="Basic" description="Type, identifiers, taxonomy.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type">
          <EnumFormField
            enumName="itemType"
            initialId={props.itemType}
            onChange={(v) => props.onItemType(v ?? 'goods')}
          />
          <input type="hidden" name="itemType" value={props.itemType} />
        </Field>
        <Field label="Name" required>
          <Input name="name" defaultValue={props.defaultName} required />
        </Field>
        <Field label="SKU" required>
          <Input name="sku" defaultValue={props.defaultSku} required />
        </Field>
        <Field label="Barcode">
          <Input name="barcode" defaultValue={props.defaultBarcode} />
        </Field>
        <Field label="Variant of (parent item)">
          <EntityFormField
            entity="item"
            name="variantOfId"
            initialId={props.variantOfId}
            onChange={props.onVariantOf}
          />
        </Field>
        <Field label="HSN / SAC">
          <Input name="hsnSac" defaultValue={props.defaultHsnSac} />
        </Field>
        <Field label="GST rate %">
          <Input
            type="number"
            step="0.01"
            name="taxRate"
            defaultValue={props.defaultGstRate}
          />
        </Field>
        <Field label="Cess %">
          <Input
            type="number"
            step="0.01"
            name="cess"
            defaultValue={props.defaultCess}
          />
        </Field>
        <Field label="Unit of measure">
          <EntityFormField
            entity="unit"
            name="unitId"
            initialId={props.unitId}
            onChange={props.onUnitId}
          />
        </Field>
        <Field label="Alt units">
          <EntityMultiFormField
            entity="unit"
            name="altUnitIds"
            initialIds={props.altUnitIds}
            onChange={props.onAltUnitIds}
          />
        </Field>
        <Field label="Sub-unit">
          <Input name="subUnit" defaultValue={props.defaultSubUnit} />
        </Field>
        <Field label="Brand">
          <EntityFormField
            entity="brand"
            name="brandId"
            initialId={props.brandId}
            onChange={props.onBrandId}
          />
        </Field>
        <Field label="Categories">
          <EntityMultiFormField
            entity="category"
            name="categoryIds"
            initialIds={props.categoryIds}
            onChange={props.onCategoryIds}
          />
          {/* Dual-write the primary id under `categoryId` for the legacy server action. */}
          <input
            type="hidden"
            name="categoryId"
            value={props.categoryIds[0] ?? ''}
          />
        </Field>
        <Field label="Manufacturer">
          <Input name="manufacturer" defaultValue={props.defaultManufacturer} />
        </Field>
        <Field label="Manufacturer part #">
          <Input name="mpn" defaultValue={props.defaultMpn} />
        </Field>
        <Field label="Country of origin">
          <Input
            name="countryOfOrigin"
            defaultValue={props.defaultCountryOfOrigin}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Description ───────────────────────────────────────────── */

interface DescriptionSectionProps {
  defaultDescription?: string;
  defaultLongDescription?: string;
  defaultFeatures?: string;
  specs: SpecRow[];
  onSpecsChange: (next: SpecRow[]) => void;
  defaultColor?: string;
  defaultSize?: string;
  defaultMaterial?: string;
}

export function DescriptionSection(props: DescriptionSectionProps) {
  return (
    <SectionCard
      title="Description"
      description="Marketing copy, attributes shoppers care about."
    >
      <div className="grid gap-4">
        <Field label="Short description">
          <Textarea
            name="description"
            defaultValue={props.defaultDescription}
            rows={2}
          />
        </Field>
        <Field label="Long description">
          <Textarea
            name="longDescription"
            defaultValue={props.defaultLongDescription}
            rows={4}
          />
        </Field>
        <Field label="Features (one per line)">
          <Textarea
            name="features"
            defaultValue={props.defaultFeatures}
            rows={3}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Color">
            <Input name="color" defaultValue={props.defaultColor} />
          </Field>
          <Field label="Size">
            <Input name="size" defaultValue={props.defaultSize} />
          </Field>
          <Field label="Material">
            <Input name="material" defaultValue={props.defaultMaterial} />
          </Field>
        </div>
        <div className="space-y-2">
          <Label>Specifications</Label>
          {props.specs.map((spec, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input
                placeholder="Key (e.g. Weight)"
                value={spec.key}
                onChange={(e) => {
                  const next = [...props.specs];
                  next[idx] = { ...spec, key: e.target.value };
                  props.onSpecsChange(next);
                }}
              />
              <Input
                placeholder="Value"
                value={spec.value}
                onChange={(e) => {
                  const next = [...props.specs];
                  next[idx] = { ...spec, value: e.target.value };
                  props.onSpecsChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  props.onSpecsChange(props.specs.filter((_, i) => i !== idx));
                }}
                aria-label="Remove specification"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              props.onSpecsChange([...props.specs, { key: '', value: '' }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add spec
          </Button>
          <input
            type="hidden"
            name="specifications"
            value={JSON.stringify(props.specs)}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Pricing ───────────────────────────────────────────────── */

interface PricingSectionProps {
  defaultSellingPrice?: number;
  currencyId: string | null;
  onCurrencyId: (v: string | null) => void;
  defaultMrp?: number;
  defaultDiscountPct?: number;
  defaultWholesalePrice?: number;
  taxInclusive: boolean;
  onTaxInclusive: (v: boolean) => void;
}

export function PricingSection(props: PricingSectionProps) {
  return (
    <SectionCard title="Pricing" description="What you sell for.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Selling price" required>
          <Input
            type="number"
            step="0.01"
            name="sellingPrice"
            defaultValue={props.defaultSellingPrice}
            required
          />
        </Field>
        <Field label="Currency">
          <EntityFormField
            entity="currency"
            name="currencyId"
            initialId={props.currencyId}
            onChange={(next, hydrated) => {
              props.onCurrencyId(next);
              // Mirror the picker's primary label into the legacy `currency` field.
              const code = hydrated?.chip.primary ?? '';
              const hidden = document.querySelector<HTMLInputElement>(
                'input[name="currency"]',
              );
              if (hidden) hidden.value = code;
            }}
          />
          <input type="hidden" name="currency" defaultValue="INR" />
        </Field>
        <Field label="MRP">
          <Input
            type="number"
            step="0.01"
            name="mrp"
            defaultValue={props.defaultMrp}
          />
        </Field>
        <Field label="Discount %">
          <Input
            type="number"
            step="0.01"
            name="discountPct"
            defaultValue={props.defaultDiscountPct}
          />
        </Field>
        <Field label="Wholesale price">
          <Input
            type="number"
            step="0.01"
            name="wholesalePrice"
            defaultValue={props.defaultWholesalePrice}
          />
        </Field>
        <Field label="Tax inclusive?">
          <div className="flex h-9 items-center gap-2">
            <Checkbox
              checked={props.taxInclusive}
              onCheckedChange={(c) => props.onTaxInclusive(Boolean(c))}
            />
            <span className="text-[12.5px] text-[var(--st-text-secondary)]">
              Prices already include tax
            </span>
            <input
              type="hidden"
              name="taxInclusive"
              value={props.taxInclusive ? 'on' : ''}
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Purchase ──────────────────────────────────────────────── */

interface PurchaseSectionProps {
  defaultCostPrice?: number;
  purchaseCurrencyId: string | null;
  onPurchaseCurrencyId: (v: string | null) => void;
  vendorIds: string[];
  onVendorIds: (ids: string[]) => void;
  defaultLeadTimeDays?: number;
}

export function PurchaseSection(props: PurchaseSectionProps) {
  return (
    <SectionCard title="Purchase" description="What you pay vendors.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Purchase price">
          <Input
            type="number"
            step="0.01"
            name="costPrice"
            defaultValue={props.defaultCostPrice}
          />
        </Field>
        <Field label="Purchase currency">
          <EntityFormField
            entity="currency"
            name="purchaseCurrencyId"
            initialId={props.purchaseCurrencyId}
            onChange={props.onPurchaseCurrencyId}
          />
        </Field>
        <Field label="Vendors">
          <EntityMultiFormField
            entity="vendor"
            name="vendorIds"
            initialIds={props.vendorIds}
            onChange={props.onVendorIds}
          />
        </Field>
        <Field label="Lead time (days)">
          <Input
            type="number"
            name="leadTimeDays"
            defaultValue={props.defaultLeadTimeDays}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Inventory ─────────────────────────────────────────────── */

interface InventorySectionProps {
  isTrackInventory: boolean;
  onIsTrackInventory: (v: boolean) => void;
  trackBatches: boolean;
  onTrackBatches: (v: boolean) => void;
  trackSerials: boolean;
  onTrackSerials: (v: boolean) => void;
  trackExpiry: boolean;
  onTrackExpiry: (v: boolean) => void;
  defaultReorderPoint?: number;
  defaultReorderQty?: number;
  defaultMaxStock?: number;
  defaultOpeningStock?: number;
  openingByWarehouse: OpeningStockRow[];
  onOpeningByWarehouse: (rows: OpeningStockRow[]) => void;
  editing: boolean;
}

export function InventorySection(props: InventorySectionProps) {
  return (
    <SectionCard
      title="Inventory"
      description="Stock tracking, batches, opening balances."
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <BoolToggle
            label="Track inventory"
            checked={props.isTrackInventory}
            onChange={props.onIsTrackInventory}
            name="isTrackInventory"
          />
          <BoolToggle
            label="Track batches"
            checked={props.trackBatches}
            onChange={props.onTrackBatches}
            name="batchTracking"
          />
          <BoolToggle
            label="Track serials"
            checked={props.trackSerials}
            onChange={props.onTrackSerials}
            name="serialTracking"
          />
          <BoolToggle
            label="Track expiry"
            checked={props.trackExpiry}
            onChange={props.onTrackExpiry}
            name="expiryTracking"
          />
        </div>

        {props.isTrackInventory ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Reorder point">
                <Input
                  type="number"
                  name="reorderPoint"
                  defaultValue={props.defaultReorderPoint}
                />
              </Field>
              <Field label="Reorder qty">
                <Input
                  type="number"
                  name="reorderQty"
                  defaultValue={props.defaultReorderQty}
                />
              </Field>
              <Field label="Max stock">
                <Input
                  type="number"
                  name="maxStock"
                  defaultValue={props.defaultMaxStock}
                />
              </Field>
              {!props.editing ? (
                <Field label="Opening stock (default warehouse)">
                  <Input
                    type="number"
                    name="stockInHand"
                    defaultValue={props.defaultOpeningStock}
                  />
                </Field>
              ) : (
                <Field label="Opening stock">
                  <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                    Use Stock Adjustments to change on-hand once an item exists.
                  </p>
                </Field>
              )}
            </div>

            {!props.editing ? (
              <div className="space-y-2">
                <Label>Opening stock per warehouse (optional)</Label>
                {props.openingByWarehouse.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2"
                  >
                    <EntityFormField
                      entity="warehouse"
                      name={`_openingWarehouseId_${idx}`}
                      initialId={row.warehouseId}
                      onChange={(next) => {
                        const list = [...props.openingByWarehouse];
                        list[idx] = { ...row, warehouseId: next };
                        props.onOpeningByWarehouse(list);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) => {
                        const list = [...props.openingByWarehouse];
                        list[idx] = { ...row, qty: e.target.value };
                        props.onOpeningByWarehouse(list);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => {
                        const list = [...props.openingByWarehouse];
                        list[idx] = { ...row, value: e.target.value };
                        props.onOpeningByWarehouse(list);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        props.onOpeningByWarehouse(
                          props.openingByWarehouse.filter((_, i) => i !== idx),
                        )
                      }
                      aria-label="Remove warehouse row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    props.onOpeningByWarehouse([
                      ...props.openingByWarehouse,
                      { warehouseId: null, qty: '', value: '' },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add warehouse
                </Button>
                <input
                  type="hidden"
                  name="openingByWarehouse"
                  value={JSON.stringify(props.openingByWarehouse)}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
