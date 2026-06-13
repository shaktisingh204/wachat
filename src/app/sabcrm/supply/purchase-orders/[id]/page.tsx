/**
 * SabCRM Supply — Purchase order detail (`/sabcrm/supply/purchase-orders/[id]`).
 *
 * Server entry for the supply flagship document-detail surface (rollout
 * WI-5). Fetches the PO, its vendor label and the lineage rail (linked
 * GRNs + bills + RFQ/bid parents) in parallel, then hands everything to
 * the detail client.
 */

import * as React from 'react';

import {
  getSabcrmSupplyPurchaseOrder,
  getSabcrmSupplyVendor,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { getSabcrmSupplyPurchaseOrderRelated } from '@/app/actions/sabcrm-supply-purchase-orders.actions';
import { PurchaseOrderDetailClient } from './purchase-order-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Purchase order — SabCRM Supply',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmSupplyPurchaseOrderDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const poRes = await getSabcrmSupplyPurchaseOrder(id);
  if (!poRes.ok) {
    return (
      <PurchaseOrderDetailClient
        po={null}
        vendorLabel={null}
        warehouseLabel={null}
        related={[]}
        error={poRes.error}
      />
    );
  }

  const po = poRes.data;
  const [vendorRes, warehouseRes, relatedRes] = await Promise.all([
    po.vendorId
      ? getSabcrmSupplyVendor(po.vendorId)
      : Promise.resolve({ ok: false as const, error: 'No vendor.' }),
    po.shipToWarehouseId
      ? import('@/app/actions/sabcrm-supply-docs.actions').then((m) =>
          m.getSabcrmSupplyWarehouse(po.shipToWarehouseId as string),
        )
      : Promise.resolve({ ok: false as const, error: 'No warehouse.' }),
    getSabcrmSupplyPurchaseOrderRelated(id),
  ]);

  const vendorLabel = vendorRes.ok
    ? vendorRes.data.displayName || vendorRes.data.name || null
    : null;
  const warehouseLabel = warehouseRes.ok
    ? warehouseRes.data.name || null
    : null;

  return (
    <PurchaseOrderDetailClient
      po={po}
      vendorLabel={vendorLabel}
      warehouseLabel={warehouseLabel}
      related={relatedRes.ok ? relatedRes.data : []}
      error={null}
    />
  );
}
