/**
 * SabCRM Supply — Stock-adjustment detail (`/sabcrm/supply/stock-adjustments/[id]`).
 *
 * Server entry: loads the adjustment, then resolves its warehouse +
 * product labels in parallel (never a raw ObjectId) before handing the
 * lot to the DocDetailPage-backed client. Reuses the shared
 * `getSabcrmSupply{StockAdjustment,Warehouse,Item}` actions.
 */

import * as React from 'react';

import {
  getSabcrmSupplyItem,
  getSabcrmSupplyStockAdjustment,
  getSabcrmSupplyWarehouse,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { StockAdjustmentDetailClient } from './stock-adjustment-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock adjustment — SabCRM Supply',
};

export default async function SabcrmSupplyStockAdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const res = await getSabcrmSupplyStockAdjustment(id);

  if (!res.ok) {
    return (
      <StockAdjustmentDetailClient
        adjustment={null}
        warehouseLabel={null}
        productLabel={null}
        error={res.error}
      />
    );
  }

  const doc = res.data;
  const [warehouseRes, productRes] = await Promise.all([
    doc.warehouseId
      ? getSabcrmSupplyWarehouse(doc.warehouseId)
      : Promise.resolve(null),
    doc.productId ? getSabcrmSupplyItem(doc.productId) : Promise.resolve(null),
  ]);

  const warehouseLabel =
    warehouseRes && warehouseRes.ok ? warehouseRes.data.name : null;
  const productLabel =
    productRes && productRes.ok
      ? productRes.data.name || productRes.data.sku
      : null;

  return (
    <StockAdjustmentDetailClient
      adjustment={doc}
      warehouseLabel={warehouseLabel}
      productLabel={productLabel}
      error={null}
    />
  );
}
