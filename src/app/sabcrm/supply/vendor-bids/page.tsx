/**
 * SabCRM Supply — Vendor bids (`/sabcrm/supply/vendor-bids`), rollout
 * WI-9.
 *
 * Server entry: the active project's vendor bids as display-ready rows
 * (`listSabcrmSupplyVendorBidsPage` — RFQ + vendor labels resolved per
 * page) + the KPI strip (`getSabcrmSupplyVendorBidKpis`), rendered
 * through the doc-surface kit via {@link VendorBidsClient} (a full-field
 * bespoke drawer: RFQ + vendor pickers, priced lines with per-line lead
 * time + notes, terms). Replaces the old generic `SupplyClient` mount.
 */

import * as React from 'react';

import {
  getSabcrmSupplyVendorBidKpis,
  listSabcrmSupplyVendorBidsPage,
} from '@/app/actions/sabcrm-supply-vendor-bids.actions';
import { VendorBidsClient } from './vendor-bids-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendor bids — SabCRM Supply',
};

export default async function SabcrmSupplyVendorBidsPage(): Promise<React.JSX.Element> {
  const [listRes, kpiRes] = await Promise.all([
    listSabcrmSupplyVendorBidsPage({ page: 1, limit: 25 }),
    getSabcrmSupplyVendorBidKpis(),
  ]);

  return (
    <VendorBidsClient
      initialRows={listRes.ok ? listRes.data.rows : []}
      initialHasMore={listRes.ok ? listRes.data.hasMore : false}
      initialError={listRes.ok ? null : listRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
