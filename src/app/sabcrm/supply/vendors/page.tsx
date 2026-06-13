/**
 * SabCRM Supply — Vendors (`/sabcrm/supply/vendors`), rollout WI-7.
 *
 * Server entry: the active project's vendors as display-ready rows
 * (`listSabcrmSupplyVendorsPage`) + the KPI strip
 * (`getSabcrmSupplyVendorKpis`), rendered through the doc-surface kit
 * via {@link VendorsClient} (a full-field bespoke drawer for this
 * master-data entity). Replaces the old generic `SupplyClient` mount.
 */

import * as React from 'react';

import {
  getSabcrmSupplyVendorKpis,
  listSabcrmSupplyVendorsPage,
} from '@/app/actions/sabcrm-supply-vendors.actions';
import { VendorsClient } from './vendors-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendors — SabCRM Supply',
};

export default async function SabcrmSupplyVendorsPage(): Promise<React.JSX.Element> {
  const [listRes, kpiRes] = await Promise.all([
    listSabcrmSupplyVendorsPage({ page: 1, limit: 25 }),
    getSabcrmSupplyVendorKpis(),
  ]);

  return (
    <VendorsClient
      initialRows={listRes.ok ? listRes.data.rows : []}
      initialHasMore={listRes.ok ? listRes.data.hasMore : false}
      initialError={listRes.ok ? null : listRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
