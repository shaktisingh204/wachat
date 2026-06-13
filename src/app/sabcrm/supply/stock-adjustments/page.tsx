/**
 * SabCRM Supply — Stock adjustments (`/sabcrm/supply/stock-adjustments`).
 *
 * Server entry for the doc-surface document surface (rollout WI-4):
 * fetches the first page of display-ready adjustment rows (warehouse +
 * product ids batch-resolved to labels server-side) and the KPI strip
 * in parallel, then hands them to the DocForm-backed client. The old
 * generic `SupplyClient` is no longer mounted here.
 */

import * as React from 'react';

import {
  getSabcrmSupplyStockAdjustmentKpis,
  listSabcrmSupplyStockAdjustmentsPage,
} from '@/app/actions/sabcrm-supply-stock-adjustments.actions';
import { StockAdjustmentsClient } from './stock-adjustments-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Stock adjustments — SabCRM Supply',
};

export default async function SabcrmSupplyStockAdjustmentsPage(): Promise<React.JSX.Element> {
  const [listRes, kpiRes] = await Promise.all([
    listSabcrmSupplyStockAdjustmentsPage({ page: 1, limit: 25 }),
    getSabcrmSupplyStockAdjustmentKpis(),
  ]);

  return (
    <StockAdjustmentsClient
      initialRows={listRes.ok ? listRes.data.rows : []}
      initialHasMore={listRes.ok ? listRes.data.hasMore : false}
      initialError={listRes.ok ? null : listRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
