/**
 * SabCRM Supply — Production orders (`/sabcrm/supply/production-orders`),
 * 20ui.
 *
 * Server entry: lists the active project's production orders through
 * the gated `listSabcrmSupplyProductionOrders` action (crate
 * `crm-production-orders`, `/v1/sabcrm/supply/production-orders`) and
 * renders via the shared {@link SupplyClient}.
 */

import * as React from 'react';

import { listSabcrmSupplyProductionOrders } from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Production orders — SabCRM Supply',
};

export default async function SabcrmSupplyProductionOrdersPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmSupplyProductionOrders({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.orderNo,
    status: doc.status ?? 'planned',
    currency: 'INR',
    cells: {
      orderNo: doc.orderNo,
      finishedGoodName: doc.finishedGoodName,
      plannedQty: doc.plannedQty,
      actualYield: doc.actualYield ?? 0,
      plannedStart: doc.plannedStart ?? '',
    },
  }));

  return (
    <SupplyClient
      kind="production-orders"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
