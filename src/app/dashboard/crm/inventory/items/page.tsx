/**
 * Canonical Items list — `/dashboard/crm/inventory/items`.
 *
 * Server component. Reads page/limit/q from the URL, hands the data to
 * `<ItemsListClient>` for the §1D experience (KPI strip, filters, view
 * switcher, bulk bar, card grid).
 *
 * Per CRM_REBUILD_PLAN §1D.1.
 */


import type { WithId } from 'mongodb';

import { getCrmProducts } from '@/app/actions/crm-products.actions';
import type { CrmProduct } from '@/lib/definitions';

import { ItemsListClient } from './_components/items-list-client';
import type { ItemKpiSnapshot, ItemListRow } from './_components/types';
import {
  inventoryValue,
  isLowStock,
  isOutOfStock,
} from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  query?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

function toRow(doc: WithId<CrmProduct>): ItemListRow {
  // The Mongo CrmProduct shape exposes inventory rows + totalStock but
  // doesn't have an explicit `status` column today. We surface a synthetic
  // active status until soft-archive lands so `<StatusPill>` has something
  // meaningful to render.
  const d = doc as WithId<CrmProduct> & {
    barcode?: string;
    vendorIds?: unknown;
    taxRateId?: unknown;
    status?: 'active' | 'archived';
    reorderPoint?: number;
    images?: string[];
  };
  const vendorIds = Array.isArray(d.vendorIds)
    ? (d.vendorIds as unknown[]).map((id) => String(id))
    : [];
  const inventory = (d.inventory ?? []).map((row) => ({
    warehouseId: String(row.warehouseId),
    stock: Number(row.stock ?? 0),
    reorderPoint: row.reorderPoint,
  }));
  return {
    _id: String(d._id),
    name: d.name,
    sku: d.sku,
    description: d.description,
    itemType: (d.itemType as 'goods' | 'service' | 'bundle') ?? 'goods',
    categoryId: d.categoryId ? String(d.categoryId) : null,
    brandId: d.brandId ? String(d.brandId) : null,
    unitId: d.unitId ? String(d.unitId) : null,
    vendorIds,
    taxRateId: d.taxRateId ? String(d.taxRateId) : null,
    hsnSac: d.hsnSac,
    barcode: d.barcode,
    currency: d.currency ?? 'INR',
    costPrice: Number(d.costPrice ?? 0),
    sellingPrice: Number(d.sellingPrice ?? 0),
    taxRate: d.taxRate,
    isTrackInventory: Boolean(d.isTrackInventory),
    inventory,
    totalStock: Number(d.totalStock ?? 0),
    reorderPoint:
      typeof d.reorderPoint === 'number'
        ? d.reorderPoint
        : inventory[0]?.reorderPoint,
    thumbnail: d.images?.[0],
    status: d.status ?? 'active',
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : undefined,
  };
}

function computeKpi(rows: ItemListRow[], total: number): ItemKpiSnapshot {
  let active = 0;
  let low = 0;
  let out = 0;
  let value = 0;
  let inStock = 0;
  for (const r of rows) {
    if ((r.status ?? 'active') === 'active') active += 1;
    if (isLowStock(r)) low += 1;
    if (isOutOfStock(r)) out += 1;
    value += inventoryValue(r);
    // Untracked items don't manage stock, so we count them as in-stock for
    // the at-a-glance tile. Tracked items must have `totalStock > 0`.
    if (!r.isTrackInventory || r.totalStock > 0) inStock += 1;
  }
  return {
    totalCount: total,
    activeCount: active,
    lowStockCount: low,
    outOfStockCount: out,
    inventoryValue: value,
    inStockCount: inStock,
  };
}

export default async function InventoryItemsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? sp.query ?? '').trim();

  // Load the current page for the table, plus a wider window for the KPI
  // strip so totals aren't capped by `limit`. The list action sources from
  // either Rust BFF or legacy Mongo — see crm-products.actions.ts.
  const [pageResult, kpiResult] = await Promise.all([
    getCrmProducts(page, limit, q || undefined),
    getCrmProducts(1, 200, undefined),
  ]);

  const rows = pageResult.products.map(toRow);
  const kpiRows = kpiResult.products.map(toRow);
  const kpi = computeKpi(kpiRows, kpiResult.total ?? kpiRows.length);
  const hasMore = page * limit < (pageResult.total ?? rows.length);

  return (
    <>
      <ItemsListClient
        items={rows}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        defaultCurrency={rows[0]?.currency ?? 'INR'}
      />
    </>
  );
}
