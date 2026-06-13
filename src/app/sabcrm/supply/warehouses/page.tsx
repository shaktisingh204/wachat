/**
 * SabCRM Supply — Warehouses (`/sabcrm/supply/warehouses`).
 *
 * Server entry for the doc-surface master-data surface (rollout WI-3):
 * fetches the first page of display-ready warehouse rows and the KPI
 * strip in parallel, then hands them to the bespoke-drawer client. The
 * old generic `SupplyClient` is no longer mounted here.
 */

import * as React from 'react';

import {
  getSabcrmSupplyWarehouseKpis,
  listSabcrmSupplyWarehousesPage,
} from '@/app/actions/sabcrm-supply-warehouses.actions';
import { WarehousesClient } from './warehouses-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Warehouses — SabCRM Supply',
};

export default async function SabcrmSupplyWarehousesPage(): Promise<React.JSX.Element> {
  const [listRes, kpiRes] = await Promise.all([
    listSabcrmSupplyWarehousesPage({ page: 1, limit: 25 }),
    getSabcrmSupplyWarehouseKpis(),
  ]);

  return (
    <WarehousesClient
      initialRows={listRes.ok ? listRes.data.rows : []}
      initialHasMore={listRes.ok ? listRes.data.hasMore : false}
      initialError={listRes.ok ? null : listRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
