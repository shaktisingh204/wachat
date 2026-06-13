/**
 * SabCRM Supply — RFQ detail (`/sabcrm/supply/rfqs/[id]`), rollout
 * WI-8.
 *
 * Server entry: loads the RFQ, its bids (vendor labels resolved) and
 * the invited-vendor labels in parallel, then resolves the catalog item
 * labels for the requested lines so the detail paper never shows a raw
 * ObjectId. Renders the doc-surface `DocDetailPage` via
 * {@link RfqDetailClient} (header / StatusFlow / meta / no-price lines /
 * bids table with shortlist+award / award→PO convert / edit / print).
 */

import * as React from 'react';

import { getSabcrmSupplyRfq } from '@/app/actions/sabcrm-supply-docs.actions';
import { getSabcrmSupplyRfqBids } from '@/app/actions/sabcrm-supply-rfqs.actions';
import type { SabcrmRfqBidRow } from '@/app/actions/sabcrm-supply-rfqs.actions.types';
import {
  sabcrmSupplyItemsApi,
  sabcrmSupplyVendorsApi,
} from '@/lib/rust-client/sabcrm-supply';
import { getCachedProjects } from '@/lib/server-cache';

import { RfqDetailClient, type RfqDetailLine } from './rfq-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'RFQ — SabCRM Supply',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmSupplyRfqDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [rfqRes, bidsRes] = await Promise.all([
    getSabcrmSupplyRfq(id),
    getSabcrmSupplyRfqBids(id),
  ]);

  if (!rfqRes.ok) {
    return (
      <RfqDetailClient
        rfqId={id}
        title="RFQ"
        status="draft"
        requiredBy={null}
        deadline={null}
        terms={null}
        invitedVendors={[]}
        lines={[]}
        bids={[]}
        seed={null}
        error={rfqRes.error}
      />
    );
  }

  const rfq = rfqRes.data;
  const bids: SabcrmRfqBidRow[] = bidsRes.ok ? bidsRes.data : [];

  // Resolve invited-vendor labels (one parallel pass) — never raw ids.
  const projects = await getCachedProjects();
  const projectId = projects[0]?._id ? String(projects[0]._id) : '';
  const invitedVendors: { id: string; label: string }[] = [];
  if (projectId) {
    await Promise.all(
      (rfq.vendorsInvited ?? []).map(async (vid) => {
        try {
          const v = await sabcrmSupplyVendorsApi.getById(projectId, vid);
          invitedVendors.push({
            id: vid,
            label: v.displayName || v.name || 'Unknown vendor',
          });
        } catch {
          invitedVendors.push({ id: vid, label: 'Unknown vendor' });
        }
      }),
    );
  }

  // Resolve item labels for the requested lines (batched, deduped) —
  // a per-id getById against the items mount, never a raw ObjectId.
  const itemIds = [...new Set((rfq.items ?? []).map((l) => l.itemId).filter(Boolean))];
  const itemLabels = new Map<string, string>();
  if (projectId) {
    await Promise.all(
      itemIds.map(async (itemId) => {
        try {
          const item = await sabcrmSupplyItemsApi.getById(projectId, itemId);
          itemLabels.set(itemId, item.name || 'Catalog item');
        } catch {
          // Item gone — line falls back to its stored description.
        }
      }),
    );
  }

  const lines: RfqDetailLine[] = (rfq.items ?? []).map((l) => ({
    label: l.description || itemLabels.get(l.itemId) || 'Catalog item',
    qty: l.qty,
    unit: l.unit,
    specs: l.specs,
  }));

  const seed = {
    id: rfq._id,
    title: rfq.title ?? '',
    requiredBy: rfq.requiredBy ?? '',
    deadline: rfq.deadline ?? '',
    terms: rfq.terms ?? '',
    invites: invitedVendors.map((v) => ({
      vendorId: v.id,
      vendorLabel: v.label,
    })),
    lines: (rfq.items ?? []).map((l) => ({
      itemId: l.itemId,
      itemLabel: itemLabels.get(l.itemId) || l.description || 'Catalog item',
      description: l.description,
      qty: l.qty,
      unit: l.unit,
      specs: l.specs,
    })),
  };

  return (
    <RfqDetailClient
      rfqId={rfq._id}
      title={rfq.title ?? 'RFQ'}
      status={String(rfq.status ?? 'draft')}
      requiredBy={rfq.requiredBy ?? null}
      deadline={rfq.deadline ?? null}
      terms={rfq.terms ?? null}
      invitedVendors={invitedVendors}
      lines={lines}
      bids={bids}
      seed={seed}
      error={null}
    />
  );
}
