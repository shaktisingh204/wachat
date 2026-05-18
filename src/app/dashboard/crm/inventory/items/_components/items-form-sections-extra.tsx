'use client';

/**
 * Section primitives for the canonical Item form — part 2.
 *
 * Covers: Images · Dimensions · Accounting · Meta (custom attrs, tags,
 * status). The Basic / Description / Pricing / Purchase / Inventory
 * sections live in `items-form-sections.tsx`.
 */

import * as React from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';

import {
  ZoruButton,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';

import { Field, SectionCard } from './items-form-primitives';
import type { SpecRow } from './use-item-form';

/* ─── Section: Images ────────────────────────────────────────────────── */

interface ImagesSectionProps {
  thumbnail: string;
  onThumbnail: (next: string) => void;
  gallery: string[];
  onGallery: (next: string[]) => void;
}

export function ImagesSection(props: ImagesSectionProps) {
  return (
    <SectionCard
      title="Images"
      description="A primary thumbnail and additional gallery shots."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <ZoruLabel>Thumbnail</ZoruLabel>
          <div className="flex items-center gap-2">
            <SabFilePickerButton
              accept="image"
              title="Pick thumbnail"
              onPick={({ url }) => props.onThumbnail(url)}
            >
              <Upload className="h-3.5 w-3.5" />{' '}
              {props.thumbnail ? 'Replace' : 'Choose'}
            </SabFilePickerButton>
            {props.thumbnail ? (
              <ZoruButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => props.onThumbnail('')}
                aria-label="Remove thumbnail"
              >
                <X className="h-3.5 w-3.5" />
              </ZoruButton>
            ) : null}
          </div>
          {props.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={props.thumbnail}
              alt="Thumbnail"
              className="h-32 w-32 rounded border border-zoru-line object-cover"
            />
          ) : null}
          <input type="hidden" name="imageUrl" value={props.thumbnail} />
        </div>
        <div className="space-y-2">
          <ZoruLabel>Gallery</ZoruLabel>
          <div className="flex flex-wrap gap-2">
            {props.gallery.map((url, idx) => (
              <div key={idx} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Gallery ${idx + 1}`}
                  className="h-20 w-20 rounded border border-zoru-line object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    props.onGallery(props.gallery.filter((_, i) => i !== idx))
                  }
                  className="absolute -right-1 -top-1 rounded-full bg-zoru-danger p-0.5 text-white"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <SabFilePickerButton
            accept="image"
            title="Add gallery image"
            onPick={({ url }) => props.onGallery([...props.gallery, url])}
          >
            <Plus className="h-3.5 w-3.5" /> Add image
          </SabFilePickerButton>
          <input
            type="hidden"
            name="galleryImages"
            value={JSON.stringify(props.gallery)}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Dimensions ────────────────────────────────────────────── */

interface DimensionsSectionProps {
  defaultLength?: number;
  defaultBreadth?: number;
  defaultHeight?: number;
  defaultVolume?: number;
  defaultGrossWeight?: number;
  defaultNetWeight?: number;
}

export function DimensionsSection(props: DimensionsSectionProps) {
  return (
    <SectionCard
      title="Dimensions"
      description="Physical L × W × H, weight and volume."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Length (cm)">
          <ZoruInput
            type="number"
            step="0.01"
            name="length"
            defaultValue={props.defaultLength}
          />
        </Field>
        <Field label="Breadth (cm)">
          <ZoruInput
            type="number"
            step="0.01"
            name="breadth"
            defaultValue={props.defaultBreadth}
          />
        </Field>
        <Field label="Height (cm)">
          <ZoruInput
            type="number"
            step="0.01"
            name="height"
            defaultValue={props.defaultHeight}
          />
        </Field>
        <Field label="Volume (cm³)">
          <ZoruInput
            type="number"
            step="0.01"
            name="volume"
            defaultValue={props.defaultVolume}
          />
        </Field>
        <Field label="Gross weight (kg)">
          <ZoruInput
            type="number"
            step="0.01"
            name="grossWeight"
            defaultValue={props.defaultGrossWeight}
          />
        </Field>
        <Field label="Net weight (kg)">
          <ZoruInput
            type="number"
            step="0.01"
            name="netWeight"
            defaultValue={props.defaultNetWeight}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Accounting ────────────────────────────────────────────── */

interface AccountingSectionProps {
  salesAccountId: string | null;
  onSalesAccountId: (v: string | null) => void;
  purchaseAccountId: string | null;
  onPurchaseAccountId: (v: string | null) => void;
  stockAccountId: string | null;
  onStockAccountId: (v: string | null) => void;
  cogsAccountId: string | null;
  onCogsAccountId: (v: string | null) => void;
  defaultTaxPreference?: 'taxable' | 'non_taxable' | 'out_of_scope';
}

export function AccountingSection(props: AccountingSectionProps) {
  return (
    <SectionCard
      title="Accounting"
      description="Chart-of-accounts wiring for posted entries."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sales account">
          <EntityFormField
            entity="account"
            name="salesAccountId"
            initialId={props.salesAccountId}
            onChange={props.onSalesAccountId}
          />
        </Field>
        <Field label="Purchase account">
          <EntityFormField
            entity="account"
            name="purchaseAccountId"
            initialId={props.purchaseAccountId}
            onChange={props.onPurchaseAccountId}
          />
        </Field>
        <Field label="Stock account">
          <EntityFormField
            entity="account"
            name="stockAccountId"
            initialId={props.stockAccountId}
            onChange={props.onStockAccountId}
          />
        </Field>
        <Field label="COGS account">
          <EntityFormField
            entity="account"
            name="cogsAccountId"
            initialId={props.cogsAccountId}
            onChange={props.onCogsAccountId}
          />
        </Field>
        <Field label="Tax preference">
          <EnumFormField
            enumName="itemTaxPreference"
            name="taxPreference"
            initialId={props.defaultTaxPreference ?? 'taxable'}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

/* ─── Section: Custom attributes + tags + status ─────────────────────── */

interface MetaSectionProps {
  customAttrs: SpecRow[];
  onCustomAttrs: (next: SpecRow[]) => void;
  defaultTags?: string;
  status: 'active' | 'archived';
  onStatus: (v: 'active' | 'archived') => void;
}

export function MetaSection(props: MetaSectionProps) {
  return (
    <SectionCard
      title="Custom attributes, tags & status"
      description="Free-form key-values, search tags, lifecycle state."
    >
      <div className="grid gap-4">
        <div className="space-y-2">
          <ZoruLabel>Custom attributes</ZoruLabel>
          {props.customAttrs.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <ZoruInput
                placeholder="Key"
                value={row.key}
                onChange={(e) => {
                  const next = [...props.customAttrs];
                  next[idx] = { ...row, key: e.target.value };
                  props.onCustomAttrs(next);
                }}
              />
              <ZoruInput
                placeholder="Value"
                value={row.value}
                onChange={(e) => {
                  const next = [...props.customAttrs];
                  next[idx] = { ...row, value: e.target.value };
                  props.onCustomAttrs(next);
                }}
              />
              <ZoruButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  props.onCustomAttrs(props.customAttrs.filter((_, i) => i !== idx))
                }
                aria-label="Remove attribute"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ZoruButton>
            </div>
          ))}
          <ZoruButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              props.onCustomAttrs([...props.customAttrs, { key: '', value: '' }])
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add attribute
          </ZoruButton>
          <input
            type="hidden"
            name="customAttributes"
            value={JSON.stringify(props.customAttrs)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tags (comma separated)">
            <ZoruInput name="tags" defaultValue={props.defaultTags} />
          </Field>
          <Field label="Status">
            <ZoruSelect
              value={props.status}
              onValueChange={(v) => props.onStatus(v as 'active' | 'archived')}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <input type="hidden" name="status" value={props.status} />
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}
