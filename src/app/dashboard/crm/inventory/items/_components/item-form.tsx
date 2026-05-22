'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

/**
 * <ItemForm> — canonical create + edit form for CRM items per
 * CRM_REBUILD_PLAN §1D.3.
 *
 * Sections (each a `<ZoruCard>`):
 *   1. Basic — type, name, SKU, barcode, variant-of, HSN/GST, units,
 *      brand, categories, manufacturer, MPN, country of origin.
 *   2. Description — short/long descriptions, features, key-value specs,
 *      color/size/material.
 *   3. Pricing — selling price, currency, MRP, discount %, wholesale,
 *      tax-inclusive flag.
 *   4. Purchase — purchase price + currency, vendors (multi), lead time.
 *   5. Inventory — track flags, reorder pt/qty/max, opening stock, per-
 *      warehouse opening rows.
 *   6. Images — thumbnail + gallery (SabFiles).
 *   7. Dimensions — L/B/H/volume + gross/net weight.
 *   8. Accounting — sales/purchase/stock/COGS accounts + tax preference.
 *   9. Custom attributes + tags + status.
 *
 * Server action: `saveCrmProduct`. The FormData field names match
 * exactly what the action reads today; new sections (purchase, accounting,
 * dimensions, specs) are surfaced through hidden inputs so the action
 * signature stays backward-compatible. Extension fields land verbatim on
 * the doc — the action accepts unknown columns via Mongo's flexible
 * schema (it's only on the Rust path that we'd need a schema change).
 *
 * Behaviour:
 *   - `?fromKind=product&fromId=` pre-fills on duplicate (server-driven).
 *   - `?type=goods|service|bundle` pre-selects type.
 *   - DirtyFormPrompt blocks tab close + reload while edits are unsaved.
 *   - Cancel · Save · Save & New · Save & Add another variant actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { saveCrmProduct } from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
  BasicSection,
  DescriptionSection,
  InventorySection,
  PricingSection,
  PurchaseSection,
} from './items-form-sections';
import {
  AccountingSection,
  DimensionsSection,
  ImagesSection,
  MetaSection,
} from './items-form-sections-extra';
import { useItemForm } from './use-item-form';

type SubmitIntent = 'save' | 'save-new' | 'save-variant';

interface ItemFormProps {
  initial?: WithId<CrmProduct> | null;
}

function SubmitButton({
  label,
  intent,
  pendingIntent,
  setIntent,
}: {
  label: string;
  intent: SubmitIntent;
  pendingIntent: SubmitIntent | null;
  setIntent: (i: SubmitIntent) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton
      type="submit"
      disabled={pending}
      onClick={() => setIntent(intent)}
      aria-busy={pending && pendingIntent === intent ? true : undefined}
    >
      {pending && pendingIntent === intent ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : null}
      {label}
    </ZoruButton>
  );
}

export function ItemForm({ initial }: ItemFormProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useZoruToast();
  const f = useItemForm({ initial });

  const [pendingIntent, setPendingIntent] = React.useState<SubmitIntent | null>(
    null,
  );

  // Smart defaults from URL.
  React.useEffect(() => {
    if (f.editing) return;
    const queryType = sp?.get('type');
    if (queryType && ['goods', 'service', 'bundle'].includes(queryType)) {
      f.setItemType(queryType);
    }
    // ?fromKind=product&fromId=<id> would pre-fill from another doc, but
    // that requires a server-side fetch — handled in the new/page route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const handleAction = async (formData: FormData) => {
    const intent = pendingIntent ?? 'save';
    const result = await saveCrmProduct(null, formData);
    if (result.error) {
      toast({
        title: 'Save failed',
        description: result.error,
        variant: 'destructive',
      });
      setPendingIntent(null);
      return;
    }
    toast({ title: result.message ?? 'Item saved' });
    // Reset dirty so DirtyFormPrompt unblocks navigation.
    f.markDirty();
    if (intent === 'save-new') {
      router.push('/dashboard/crm/inventory/items/new');
      return;
    }
    if (intent === 'save-variant') {
      const newId =
        (result.newProduct?._id as string | undefined) ??
        (initial?._id ? String(initial._id) : undefined);
      router.push(
        newId
          ? `/dashboard/crm/inventory/items/new?fromKind=product&fromId=${newId}`
          : '/dashboard/crm/inventory/items/new',
      );
      return;
    }
    router.push('/dashboard/crm/inventory/items');
  };

  const initialAny = initial as
    | (WithId<CrmProduct> & Record<string, unknown>)
    | null
    | undefined;

  return (
    <form action={handleAction} className="flex flex-col gap-4 pb-20">
      <DirtyFormPrompt dirty={f.dirty} />

      {f.editing ? (
        <input type="hidden" name="productId" value={String(initial!._id)} />
      ) : null}

      <BasicSection
        itemType={f.itemType}
        onItemType={f.setItemType}
        defaultName={initial?.name}
        defaultSku={initial?.sku}
        defaultBarcode={
          (initialAny?.barcode as string | undefined) ?? undefined
        }
        variantOfId={f.variantOfId}
        onVariantOf={f.setVariantOfId}
        defaultHsnSac={initial?.hsnSac}
        defaultGstRate={initial?.taxRate ?? ''}
        defaultCess={(initialAny?.cess as number | undefined) ?? ''}
        unitId={f.unitId}
        onUnitId={f.setUnitId}
        altUnitIds={f.altUnitIds}
        onAltUnitIds={f.setAltUnitIds}
        defaultSubUnit={initialAny?.subUnit as string | undefined}
        brandId={f.brandId}
        onBrandId={f.setBrandId}
        categoryIds={f.categoryIds}
        onCategoryIds={f.setCategoryIds}
        defaultManufacturer={initialAny?.manufacturer as string | undefined}
        defaultMpn={initialAny?.mpn as string | undefined}
        defaultCountryOfOrigin={
          initialAny?.countryOfOrigin as string | undefined
        }
      />

      <DescriptionSection
        defaultDescription={initial?.description}
        defaultLongDescription={initialAny?.longDescription as string | undefined}
        defaultFeatures={initialAny?.features as string | undefined}
        specs={f.specs}
        onSpecsChange={f.setSpecs}
        defaultColor={initialAny?.color as string | undefined}
        defaultSize={initialAny?.size as string | undefined}
        defaultMaterial={initialAny?.material as string | undefined}
      />

      <PricingSection
        defaultSellingPrice={initial?.sellingPrice}
        currencyId={f.currencyId}
        onCurrencyId={f.setCurrencyId}
        defaultMrp={initialAny?.mrp as number | undefined}
        defaultDiscountPct={initialAny?.discountPct as number | undefined}
        defaultWholesalePrice={initialAny?.wholesalePrice as number | undefined}
        taxInclusive={f.taxInclusive}
        onTaxInclusive={f.setTaxInclusive}
      />

      <PurchaseSection
        defaultCostPrice={initial?.costPrice}
        purchaseCurrencyId={f.purchaseCurrencyId}
        onPurchaseCurrencyId={f.setPurchaseCurrencyId}
        vendorIds={f.vendorIds}
        onVendorIds={f.setVendorIds}
        defaultLeadTimeDays={initialAny?.leadTimeDays as number | undefined}
      />

      <InventorySection
        isTrackInventory={f.isTrackInventory}
        onIsTrackInventory={f.setIsTrackInventory}
        trackBatches={f.trackBatches}
        onTrackBatches={f.setTrackBatches}
        trackSerials={f.trackSerials}
        onTrackSerials={f.setTrackSerials}
        trackExpiry={f.trackExpiry}
        onTrackExpiry={f.setTrackExpiry}
        defaultReorderPoint={
          (initialAny?.reorderPoint as number | undefined) ??
          initial?.inventory?.[0]?.reorderPoint
        }
        defaultReorderQty={initialAny?.reorderQty as number | undefined}
        defaultMaxStock={initialAny?.maxStock as number | undefined}
        defaultOpeningStock={initial?.totalStock}
        openingByWarehouse={f.openingByWarehouse}
        onOpeningByWarehouse={f.setOpeningByWarehouse}
        editing={f.editing}
      />

      <ImagesSection
        thumbnail={f.thumbnail}
        onThumbnail={f.setThumbnail}
        gallery={f.gallery}
        onGallery={f.setGallery}
      />

      <DimensionsSection
        defaultLength={initial?.dimensions?.length}
        defaultBreadth={initial?.dimensions?.breadth}
        defaultHeight={initial?.dimensions?.height}
        defaultVolume={initial?.dimensions?.volume}
        defaultGrossWeight={initial?.weight?.gross}
        defaultNetWeight={initial?.weight?.net}
      />

      <AccountingSection
        salesAccountId={f.salesAccountId}
        onSalesAccountId={f.setSalesAccountId}
        purchaseAccountId={f.purchaseAccountId}
        onPurchaseAccountId={f.setPurchaseAccountId}
        stockAccountId={f.stockAccountId}
        onStockAccountId={f.setStockAccountId}
        cogsAccountId={f.cogsAccountId}
        onCogsAccountId={f.setCogsAccountId}
        defaultTaxPreference={
          (initialAny?.taxPreference as
            | 'taxable'
            | 'non_taxable'
            | 'out_of_scope'
            | undefined) ?? 'taxable'
        }
      />

      <MetaSection
        customAttrs={f.customAttrs}
        onCustomAttrs={f.setCustomAttrs}
        defaultTags={
          Array.isArray(initialAny?.tags)
            ? (initialAny?.tags as string[]).join(', ')
            : (initialAny?.tags as string | undefined)
        }
        status={f.status}
        onStatus={f.setStatus}
      />

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-zoru-line bg-zoru-bg px-2 py-3">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              f.editing
                ? `/dashboard/crm/inventory/items/${String(initial!._id)}`
                : '/dashboard/crm/inventory/items'
            }
          >
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton
          label={f.editing ? 'Save changes' : 'Save'}
          intent="save"
          pendingIntent={pendingIntent}
          setIntent={setPendingIntent}
        />
        {!f.editing ? (
          <>
            <SubmitButton
              label="Save & New"
              intent="save-new"
              pendingIntent={pendingIntent}
              setIntent={setPendingIntent}
            />
            <SubmitButton
              label="Save & Add variant"
              intent="save-variant"
              pendingIntent={pendingIntent}
              setIntent={setPendingIntent}
            />
          </>
        ) : null}
      </div>
    </form>
  );
}
