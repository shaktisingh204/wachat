/**
 * SabCRM Supply — Vendor bids (`/sabcrm/supply/vendor-bids`), 20ui.
 *
 * Server entry: lists the active project's vendor bids through the
 * gated `listSabcrmSupplyVendorBids` action (crate `crm-vendor-bids`,
 * `/v1/sabcrm/supply/vendor-bids`). RFQs + vendors are fetched in
 * parallel — they feed the name columns and the "New bid" dialog's
 * pickers. Awarding a bid cascades the parent RFQ to `awarded` on the
 * Rust side.
 */

import * as React from 'react';

import {
  listSabcrmSupplyVendorBids,
  listSabcrmSupplyRfqs,
  listSabcrmSupplyVendors,
} from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendor bids — SabCRM Supply',
};

export default async function SabcrmSupplyVendorBidsPage(): Promise<React.JSX.Element> {
  const [res, rfqsRes, vendorsRes] = await Promise.all([
    listSabcrmSupplyVendorBids({ limit: 100 }),
    listSabcrmSupplyRfqs({ limit: 100 }),
    listSabcrmSupplyVendors({ limit: 100 }),
  ]);
  const docs = res.ok ? res.data : [];
  const rfqs = rfqsRes.ok ? rfqsRes.data : [];
  const vendors = vendorsRes.ok ? vendorsRes.data : [];
  const rfqTitle = new Map(rfqs.map((r) => [r._id, r.title]));
  const vendorName = new Map(vendors.map((v) => [v._id ?? '', v.name]));

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label:
      doc.vendorName || vendorName.get(doc.vendorId) || 'vendor bid',
    status: String(doc.status ?? 'submitted'),
    currency: doc.currency || 'INR',
    cells: {
      vendor: doc.vendorName || vendorName.get(doc.vendorId) || '—',
      rfq: rfqTitle.get(doc.rfqId) ?? '—',
      submittedAt: doc.submittedAt ?? '',
      total: doc.totals?.total ?? 0,
    },
  }));

  return (
    <SupplyClient
      kind="vendor-bids"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
      selectOptions={{
        rfqs: rfqs.map((r) => ({ value: r._id, label: r.title })),
        vendors: vendors.flatMap((v) =>
          v._id ? [{ value: v._id, label: v.name }] : [],
        ),
      }}
    />
  );
}
