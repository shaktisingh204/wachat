/**
 * SabCRM Supply — Purchase orders (`/sabcrm/supply/purchase-orders`),
 * 20ui.
 *
 * Server entry: lists the active project's purchase orders through the
 * gated `listSabcrmSupplyPurchaseOrders` action (crate
 * `crm-purchase-orders`, `/v1/sabcrm/supply/purchase-orders`). Vendors
 * are fetched in parallel — they feed both the Vendor column (id →
 * name) and the "New purchase order" dialog's picker.
 */

import * as React from 'react';

import {
  listSabcrmSupplyPurchaseOrders,
  listSabcrmSupplyVendors,
} from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Purchase orders — SabCRM Supply',
};

export default async function SabcrmSupplyPurchaseOrdersPage(): Promise<React.JSX.Element> {
  const [res, vendorsRes] = await Promise.all([
    listSabcrmSupplyPurchaseOrders({ limit: 100 }),
    listSabcrmSupplyVendors({ limit: 100 }),
  ]);
  const docs = res.ok ? res.data : [];
  const vendors = vendorsRes.ok ? vendorsRes.data : [];
  const vendorName = new Map(vendors.map((v) => [v._id ?? '', v.name]));

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.poNo,
    status: String(doc.status ?? 'draft'),
    currency: doc.currency || 'INR',
    cells: {
      poNo: doc.poNo,
      date: doc.date,
      vendor: vendorName.get(doc.vendorId) ?? '—',
      total: doc.totals?.total ?? 0,
    },
  }));

  return (
    <SupplyClient
      kind="purchase-orders"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
      selectOptions={{
        vendors: vendors.flatMap((v) =>
          v._id ? [{ value: v._id, label: v.name }] : [],
        ),
      }}
    />
  );
}
