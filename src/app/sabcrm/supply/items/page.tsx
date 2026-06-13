/**
 * SabCRM Supply — Items (`/sabcrm/supply/items`).
 *
 * Server entry for the doc-surface master-data surface (rollout WI-2):
 * fetches the first page of display-ready item rows (per-warehouse stock
 * labels batch-resolved server-side — never a raw ObjectId) and the KPI
 * strip in parallel, then hands them to the bespoke-drawer client. The
 * old generic `SupplyClient` is no longer mounted here.
 */

import * as React from 'react';

import {
  getSabcrmSupplyItemKpis,
  listSabcrmSupplyItemsPage,
} from '@/app/actions/sabcrm-supply-items.actions';
import { ItemsClient } from './items-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Items — SabCRM Supply',
};

export default async function SabcrmSupplyItemsPage(): Promise<React.JSX.Element> {
  const [listRes, kpiRes] = await Promise.all([
    listSabcrmSupplyItemsPage({ page: 1, limit: 25 }),
    getSabcrmSupplyItemKpis(),
  ]);

  return (
    <ItemsClient
      initialRows={listRes.ok ? listRes.data.rows : []}
      initialHasMore={listRes.ok ? listRes.data.hasMore : false}
      initialError={listRes.ok ? null : listRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
