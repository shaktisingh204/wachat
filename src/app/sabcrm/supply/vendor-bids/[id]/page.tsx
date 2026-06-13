/**
 * SabCRM Supply — Vendor bid detail
 * (`/sabcrm/supply/vendor-bids/[id]`), rollout WI-9.
 *
 * Server entry: loads the bid, then resolves the vendor label, the RFQ
 * label and the catalog item labels for the priced lines (one batched
 * pass each) so the detail paper never shows a raw ObjectId. Renders
 * the doc-surface `DocDetailPage` via {@link VendorBidDetailClient}
 * (header / StatusFlow / vendor party / meta / priced lines / totals /
 * shortlist+award+reject / award→PO convert / edit / print).
 */

import * as React from 'react';

import { getSabcrmSupplyVendorBid } from '@/app/actions/sabcrm-supply-docs.actions';
import {
  sabcrmSupplyItemsApi,
  sabcrmSupplyRfqsApi,
  sabcrmSupplyVendorsApi,
} from '@/lib/rust-client/sabcrm-supply';
import { getCachedProjects } from '@/lib/server-cache';

import {
  VendorBidDetailClient,
  type BidDetailLine,
} from './vendor-bid-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendor bid — SabCRM Supply',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmSupplyVendorBidDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const bidRes = await getSabcrmSupplyVendorBid(id);

  if (!bidRes.ok) {
    return (
      <VendorBidDetailClient
        bidId={id}
        rfqId={null}
        rfqLabel={null}
        vendorLabel={null}
        currency="INR"
        status="submitted"
        submittedAt={null}
        terms={null}
        lines={[]}
        total={0}
        seed={null}
        error={bidRes.error}
      />
    );
  }

  const bid = bidRes.data;
  const projects = await getCachedProjects();
  const projectId = projects[0]?._id ? String(projects[0]._id) : '';

  let vendorLabel: string | null = bid.vendorName ?? null;
  let rfqLabel: string | null = null;
  const itemLabels = new Map<string, string>();

  if (projectId) {
    const itemIds = [
      ...new Set((bid.items ?? []).map((l) => l.itemId).filter(Boolean)),
    ] as string[];
    await Promise.all([
      (async () => {
        if (!bid.vendorId) return;
        try {
          const v = await sabcrmSupplyVendorsApi.getById(projectId, bid.vendorId);
          vendorLabel = v.displayName || v.name || vendorLabel;
        } catch {
          // Vendor gone — falls back to the cached name.
        }
      })(),
      (async () => {
        if (!bid.rfqId) return;
        try {
          const r = await sabcrmSupplyRfqsApi.getById(projectId, bid.rfqId);
          rfqLabel = r.title || 'Untitled RFQ';
        } catch {
          rfqLabel = null;
        }
      })(),
      ...itemIds.map(async (itemId) => {
        try {
          const item = await sabcrmSupplyItemsApi.getById(projectId, itemId);
          itemLabels.set(itemId, item.name || 'Catalog item');
        } catch {
          // Item gone — line falls back to a generic label.
        }
      }),
    ]);
  }

  const lines: BidDetailLine[] = (bid.items ?? []).map((l) => ({
    label: l.itemId ? (itemLabels.get(l.itemId) ?? 'Catalog item') : 'Custom line',
    qty: l.qty,
    rate: l.rate,
    leadTimeDays: l.leadTimeDays,
    notes: l.notes,
  }));

  const total =
    bid.totals?.total && bid.totals.total > 0
      ? bid.totals.total
      : (bid.items ?? []).reduce((s, it) => s + (it.qty ?? 0) * (it.rate ?? 0), 0);

  const seed = {
    id: bid._id,
    rfqId: bid.rfqId ?? '',
    rfqLabel: rfqLabel ?? '',
    vendorId: bid.vendorId ?? '',
    vendorLabel: vendorLabel ?? '',
    currency: bid.currency || 'INR',
    terms: bid.terms ?? '',
    lines: (bid.items ?? []).map((l) => ({
      itemId: l.itemId,
      itemLabel: l.itemId ? itemLabels.get(l.itemId) : undefined,
      qty: l.qty,
      rate: l.rate,
      leadTimeDays: l.leadTimeDays,
      notes: l.notes,
    })),
  };

  return (
    <VendorBidDetailClient
      bidId={bid._id}
      rfqId={bid.rfqId ?? null}
      rfqLabel={rfqLabel}
      vendorLabel={vendorLabel}
      currency={bid.currency || 'INR'}
      status={String(bid.status ?? 'submitted')}
      submittedAt={bid.submittedAt ?? bid.createdAt ?? null}
      terms={bid.terms ?? null}
      lines={lines}
      total={total}
      seed={seed}
      error={null}
    />
  );
}
