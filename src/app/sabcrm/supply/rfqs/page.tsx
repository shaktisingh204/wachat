/**
 * SabCRM Supply — RFQs (`/sabcrm/supply/rfqs`), rollout WI-8.
 *
 * Server entry: the active project's RFQs as display-ready rows
 * (`listSabcrmSupplyRfqsPage` — invited + bid counts resolved per page)
 * + the KPI strip (`getSabcrmSupplyRfqKpis`), rendered through the
 * doc-surface kit via {@link RfqsClient} (a full-field bespoke drawer:
 * title, dates, terms, multi-vendor invite rows, no-price line editor).
 * Replaces the old generic `SupplyClient` mount.
 */

import * as React from 'react';

import {
  getSabcrmSupplyRfqKpis,
  listSabcrmSupplyRfqsPage,
} from '@/app/actions/sabcrm-supply-rfqs.actions';
import { RfqsClient } from './rfqs-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RFQs — SabCRM Supply',
};

export default async function SabcrmSupplyRfqsPage(): Promise<React.JSX.Element> {
  const [listRes, kpiRes] = await Promise.all([
    listSabcrmSupplyRfqsPage({ page: 1, limit: 25 }),
    getSabcrmSupplyRfqKpis(),
  ]);

  return (
    <RfqsClient
      initialRows={listRes.ok ? listRes.data.rows : []}
      initialHasMore={listRes.ok ? listRes.data.hasMore : false}
      initialError={listRes.ok ? null : listRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
