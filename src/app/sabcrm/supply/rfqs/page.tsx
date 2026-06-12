/**
 * SabCRM Supply — RFQs (`/sabcrm/supply/rfqs`), 20ui.
 *
 * Server entry: lists the active project's requests-for-quotation
 * through the gated `listSabcrmSupplyRfqs` action (crate `crm-rfqs`,
 * `/v1/sabcrm/supply/rfqs`). Items feed the "New RFQ" dialog's picker;
 * the Bids column counts `vendorBid` lineage back-links pushed by
 * `crm-vendor-bids` (vendor bids have their own page at
 * `/sabcrm/supply/vendor-bids`).
 */

import * as React from 'react';

import {
  listSabcrmSupplyRfqs,
  listSabcrmSupplyItems,
} from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RFQs — SabCRM Supply',
};

export default async function SabcrmSupplyRfqsPage(): Promise<React.JSX.Element> {
  const [res, itemsRes] = await Promise.all([
    listSabcrmSupplyRfqs({ limit: 100 }),
    listSabcrmSupplyItems({ limit: 100 }),
  ]);
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.title,
    status: String(doc.status ?? 'draft'),
    currency: 'INR',
    cells: {
      title: doc.title,
      lines: doc.items?.length ?? 0,
      requiredBy: doc.requiredBy ?? '',
      deadline: doc.deadline ?? '',
      bids:
        doc.lineage?.filter((l) => l.kind === 'vendorBid').length ?? 0,
    },
  }));

  return (
    <SupplyClient
      kind="rfqs"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
      selectOptions={{
        items: (itemsRes.ok ? itemsRes.data : []).flatMap((i) =>
          i._id ? [{ value: i._id, label: `${i.name} (${i.sku})` }] : [],
        ),
      }}
    />
  );
}
