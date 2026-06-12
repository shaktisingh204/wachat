/**
 * SabCRM Supply — Items (`/sabcrm/supply/items`), 20ui.
 *
 * Server entry: lists the active project's inventory items through the
 * gated `listSabcrmSupplyItems` action (crate `crm-items`,
 * `/v1/sabcrm/supply/items`) and renders via the shared
 * {@link SupplyClient}.
 */

import * as React from 'react';

import { listSabcrmSupplyItems } from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Items — SabCRM Supply',
};

export default async function SabcrmSupplyItemsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmSupplyItems({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id ?? '',
    label: doc.name,
    status: 'active',
    currency: doc.currency || 'INR',
    cells: {
      name: doc.name,
      sku: doc.sku,
      itemType: doc.itemType === 'service' ? 'Service' : 'Goods',
      costPrice: doc.costPrice ?? 0,
      sellingPrice: doc.sellingPrice ?? 0,
      totalStock: doc.totalStock ?? 0,
    },
  }));

  return (
    <SupplyClient
      kind="items"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
