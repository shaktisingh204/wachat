/**
 * SabCRM Supply — Goods receipts (`/sabcrm/supply/grn`), 20ui.
 *
 * Server entry: lists the active project's GRNs through the gated
 * `listSabcrmSupplyGrns` action (crate `crm-grns`,
 * `/v1/sabcrm/supply/grn`). Vendors, warehouses, and items are fetched
 * in parallel — they feed the name columns and the "New GRN" dialog's
 * pickers.
 */

import * as React from 'react';

import {
  listSabcrmSupplyGrns,
  listSabcrmSupplyVendors,
  listSabcrmSupplyWarehouses,
  listSabcrmSupplyItems,
} from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Goods receipts — SabCRM Supply',
};

export default async function SabcrmSupplyGrnPage(): Promise<React.JSX.Element> {
  const [res, vendorsRes, warehousesRes, itemsRes] = await Promise.all([
    listSabcrmSupplyGrns({ limit: 100 }),
    listSabcrmSupplyVendors({ limit: 100 }),
    listSabcrmSupplyWarehouses({ limit: 100 }),
    listSabcrmSupplyItems({ limit: 100 }),
  ]);
  const docs = res.ok ? res.data : [];
  const vendors = vendorsRes.ok ? vendorsRes.data : [];
  const warehouses = warehousesRes.ok ? warehousesRes.data : [];
  const items = itemsRes.ok ? itemsRes.data : [];
  const vendorName = new Map(vendors.map((v) => [v._id ?? '', v.name]));
  const warehouseName = new Map(warehouses.map((w) => [w._id, w.name]));

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.grnNo,
    status: String(doc.status ?? 'draft'),
    currency: 'INR',
    cells: {
      grnNo: doc.grnNo,
      date: doc.date,
      vendor: vendorName.get(doc.vendorId) ?? '—',
      warehouse: warehouseName.get(doc.warehouseId) ?? '—',
      lines: doc.items?.length ?? 0,
    },
  }));

  return (
    <SupplyClient
      kind="grn"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
      selectOptions={{
        vendors: vendors.flatMap((v) =>
          v._id ? [{ value: v._id, label: v.name }] : [],
        ),
        warehouses: warehouses.map((w) => ({ value: w._id, label: w.name })),
        items: items.flatMap((i) =>
          i._id ? [{ value: i._id, label: `${i.name} (${i.sku})` }] : [],
        ),
      }}
    />
  );
}
