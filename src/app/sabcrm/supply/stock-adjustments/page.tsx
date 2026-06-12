/**
 * SabCRM Supply — Stock adjustments (`/sabcrm/supply/stock-adjustments`),
 * 20ui.
 *
 * Server entry: lists the active project's stock adjustments through the
 * gated `listSabcrmSupplyStockAdjustments` action (crate
 * `crm-stock-adjustments`, `/v1/sabcrm/supply/stock-adjustments`).
 * Warehouses + items are fetched in parallel to feed the "New
 * adjustment" dialog's pickers.
 */

import * as React from 'react';

import {
  listSabcrmSupplyStockAdjustments,
  listSabcrmSupplyWarehouses,
  listSabcrmSupplyItems,
} from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock adjustments — SabCRM Supply',
};

export default async function SabcrmSupplyStockAdjustmentsPage(): Promise<React.JSX.Element> {
  const [res, warehousesRes, itemsRes] = await Promise.all([
    listSabcrmSupplyStockAdjustments({ limit: 100 }),
    listSabcrmSupplyWarehouses({ limit: 100 }),
    listSabcrmSupplyItems({ limit: 100 }),
  ]);
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.adjustmentNumber || doc.reason,
    status: doc.status ?? 'pending',
    currency: 'INR',
    cells: {
      date: doc.date,
      adjustmentNumber: doc.adjustmentNumber ?? '',
      reason: doc.reason,
      quantity: doc.quantity,
    },
  }));

  return (
    <SupplyClient
      kind="stock-adjustments"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
      selectOptions={{
        warehouses: (warehousesRes.ok ? warehousesRes.data : []).map((w) => ({
          value: w._id,
          label: w.name,
        })),
        items: (itemsRes.ok ? itemsRes.data : []).flatMap((i) =>
          i._id ? [{ value: i._id, label: `${i.name} (${i.sku})` }] : [],
        ),
      }}
    />
  );
}
