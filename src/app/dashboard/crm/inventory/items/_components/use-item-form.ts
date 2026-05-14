'use client';

/**
 * useItemForm — state container for the canonical `<ItemForm>`.
 *
 * Owns the controlled state every section needs (entity-picker selections,
 * toggle bools, dynamic spec/attribute rows, image URLs). The form itself
 * uses `<form action={…}>` so the underlying server action still reads
 * the same FormData keys as before (`name`, `sku`, `costPrice`,
 * `sellingPrice`, `taxRate`, `categoryId`, `brandId`, `unitId`, `imageUrl`,
 * etc.) — the new fields are written as additional hidden inputs.
 */

import * as React from 'react';
import type { WithId } from 'mongodb';

import type { CrmProduct } from '@/lib/definitions';

export interface SpecRow {
  key: string;
  value: string;
}

export interface OpeningStockRow {
  warehouseId: string | null;
  qty: string;
  value: string;
}

interface UseItemFormArgs {
  initial?: WithId<CrmProduct> | null;
}

export function useItemForm({ initial }: UseItemFormArgs) {
  const editing = Boolean(initial);

  /* Basic */
  const [itemType, setItemType] = React.useState<string>(
    (initial?.itemType as string) ?? 'goods',
  );
  const [variantOfId, setVariantOfId] = React.useState<string | null>(
    (initial as unknown as { variantOfId?: string })?.variantOfId ?? null,
  );
  const [brandId, setBrandId] = React.useState<string | null>(
    initial?.brandId ? String(initial.brandId) : null,
  );
  const [unitId, setUnitId] = React.useState<string | null>(
    initial?.unitId ? String(initial.unitId) : null,
  );
  const [altUnitIds, setAltUnitIds] = React.useState<string[]>(
    ((initial as unknown as { altUnitIds?: string[] })?.altUnitIds ?? []).map(String),
  );
  const [categoryIds, setCategoryIds] = React.useState<string[]>(() => {
    const multi = (initial as unknown as { categoryIds?: unknown[] })?.categoryIds;
    if (Array.isArray(multi) && multi.length > 0) return multi.map(String);
    if (initial?.categoryId) return [String(initial.categoryId)];
    return [];
  });

  /* Specs */
  const [specs, setSpecs] = React.useState<SpecRow[]>(() => {
    const raw = (initial as unknown as { specifications?: SpecRow[] })?.specifications;
    return Array.isArray(raw) ? raw : [];
  });

  /* Pricing */
  const [currencyId, setCurrencyId] = React.useState<string | null>(
    initial?.currency ?? null,
  );
  const [taxInclusive, setTaxInclusive] = React.useState<boolean>(
    Boolean((initial as unknown as { taxInclusive?: boolean })?.taxInclusive),
  );

  /* Purchase */
  const [purchaseCurrencyId, setPurchaseCurrencyId] = React.useState<string | null>(
    (initial as unknown as { purchaseCurrencyId?: string })?.purchaseCurrencyId ??
      initial?.currency ??
      null,
  );
  const [vendorIds, setVendorIds] = React.useState<string[]>(
    ((initial as unknown as { vendorIds?: unknown[] })?.vendorIds ?? []).map(String),
  );

  /* Inventory */
  const [isTrackInventory, setIsTrackInventory] = React.useState<boolean>(
    Boolean(initial?.isTrackInventory),
  );
  const [trackBatches, setTrackBatches] = React.useState<boolean>(
    Boolean(initial?.batchTracking),
  );
  const [trackSerials, setTrackSerials] = React.useState<boolean>(
    Boolean((initial as unknown as { serialTracking?: boolean })?.serialTracking),
  );
  const [trackExpiry, setTrackExpiry] = React.useState<boolean>(
    Boolean((initial as unknown as { expiryTracking?: boolean })?.expiryTracking),
  );
  const [openingByWarehouse, setOpeningByWarehouse] = React.useState<
    OpeningStockRow[]
  >([]);

  /* Images */
  const [thumbnail, setThumbnail] = React.useState<string>(
    initial?.images?.[0] ?? '',
  );
  const [gallery, setGallery] = React.useState<string[]>(
    (initial?.images ?? []).slice(1),
  );

  /* Accounting */
  const [salesAccountId, setSalesAccountId] = React.useState<string | null>(
    (initial as unknown as { salesAccountId?: string })?.salesAccountId ?? null,
  );
  const [purchaseAccountId, setPurchaseAccountId] = React.useState<string | null>(
    (initial as unknown as { purchaseAccountId?: string })?.purchaseAccountId ??
      null,
  );
  const [stockAccountId, setStockAccountId] = React.useState<string | null>(
    (initial as unknown as { stockAccountId?: string })?.stockAccountId ?? null,
  );
  const [cogsAccountId, setCogsAccountId] = React.useState<string | null>(
    (initial as unknown as { cogsAccountId?: string })?.cogsAccountId ?? null,
  );

  /* Meta */
  const [customAttrs, setCustomAttrs] = React.useState<SpecRow[]>(() => {
    const raw = (initial as unknown as { customAttributes?: SpecRow[] })
      ?.customAttributes;
    return Array.isArray(raw) ? raw : [];
  });
  const [status, setStatus] = React.useState<'active' | 'archived'>(
    ((initial as unknown as { status?: 'active' | 'archived' })?.status as
      | 'active'
      | 'archived') ?? 'active',
  );

  /* Dirty-prompt — any setter flips this once. */
  const [dirty, setDirty] = React.useState(false);
  const markDirty = React.useCallback(() => setDirty(true), []);
  React.useEffect(() => {
    if (!dirty) return;
    /* no-op — DirtyFormPrompt drives the beforeunload handler. */
  }, [dirty]);

  return {
    editing,
    /* Basic */
    itemType,
    setItemType: (v: string) => {
      setItemType(v);
      markDirty();
    },
    variantOfId,
    setVariantOfId: (v: string | null) => {
      setVariantOfId(v);
      markDirty();
    },
    brandId,
    setBrandId: (v: string | null) => {
      setBrandId(v);
      markDirty();
    },
    unitId,
    setUnitId: (v: string | null) => {
      setUnitId(v);
      markDirty();
    },
    altUnitIds,
    setAltUnitIds: (v: string[]) => {
      setAltUnitIds(v);
      markDirty();
    },
    categoryIds,
    setCategoryIds: (v: string[]) => {
      setCategoryIds(v);
      markDirty();
    },
    /* Specs */
    specs,
    setSpecs: (v: SpecRow[]) => {
      setSpecs(v);
      markDirty();
    },
    /* Pricing */
    currencyId,
    setCurrencyId: (v: string | null) => {
      setCurrencyId(v);
      markDirty();
    },
    taxInclusive,
    setTaxInclusive: (v: boolean) => {
      setTaxInclusive(v);
      markDirty();
    },
    /* Purchase */
    purchaseCurrencyId,
    setPurchaseCurrencyId: (v: string | null) => {
      setPurchaseCurrencyId(v);
      markDirty();
    },
    vendorIds,
    setVendorIds: (v: string[]) => {
      setVendorIds(v);
      markDirty();
    },
    /* Inventory */
    isTrackInventory,
    setIsTrackInventory: (v: boolean) => {
      setIsTrackInventory(v);
      markDirty();
    },
    trackBatches,
    setTrackBatches: (v: boolean) => {
      setTrackBatches(v);
      markDirty();
    },
    trackSerials,
    setTrackSerials: (v: boolean) => {
      setTrackSerials(v);
      markDirty();
    },
    trackExpiry,
    setTrackExpiry: (v: boolean) => {
      setTrackExpiry(v);
      markDirty();
    },
    openingByWarehouse,
    setOpeningByWarehouse: (v: OpeningStockRow[]) => {
      setOpeningByWarehouse(v);
      markDirty();
    },
    /* Images */
    thumbnail,
    setThumbnail: (v: string) => {
      setThumbnail(v);
      markDirty();
    },
    gallery,
    setGallery: (v: string[]) => {
      setGallery(v);
      markDirty();
    },
    /* Accounting */
    salesAccountId,
    setSalesAccountId: (v: string | null) => {
      setSalesAccountId(v);
      markDirty();
    },
    purchaseAccountId,
    setPurchaseAccountId: (v: string | null) => {
      setPurchaseAccountId(v);
      markDirty();
    },
    stockAccountId,
    setStockAccountId: (v: string | null) => {
      setStockAccountId(v);
      markDirty();
    },
    cogsAccountId,
    setCogsAccountId: (v: string | null) => {
      setCogsAccountId(v);
      markDirty();
    },
    /* Meta */
    customAttrs,
    setCustomAttrs: (v: SpecRow[]) => {
      setCustomAttrs(v);
      markDirty();
    },
    status,
    setStatus: (v: 'active' | 'archived') => {
      setStatus(v);
      markDirty();
    },
    /* Dirty */
    dirty,
    markDirty,
  };
}
