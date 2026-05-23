/**
 * Canonical Vendor Bids list — `/dashboard/crm/purchases/vendor-bids`.
 *
 * Server component. Reads page/limit/q from the URL, fetches via the
 * canonical (Rust-backed) `listVendorBids` action, then projects each
 * `CrmVendorBidDoc` into the `VendorBidListRow` wire shape the client
 * islands consume. KPI strip values are computed in the same pass so
 * the client doesn't need a follow-up round trip.
 *
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D (thin spec per scope-
 * cap — no saved-presets, no activity-sub-route, list + new + detail
 * only).
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listVendorBids } from '@/app/actions/crm/vendor-bids.actions';
import type { CrmVendorBidDoc } from '@/lib/rust-client/crm-vendor-bids';

import { VendorBidListClient } from './_components/vendor-bid-list-client';
import type {
  VendorBidKpiSummary,
  VendorBidListRow,
} from './_components/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function maxLeadTime(items?: CrmVendorBidDoc['items']): number | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  let max = -Infinity;
  for (const it of items) {
    const l = typeof it.leadTimeDays === 'number' ? it.leadTimeDays : null;
    if (l != null && l > max) max = l;
  }
  return Number.isFinite(max) && max >= 0 ? max : undefined;
}

function toRow(doc: CrmVendorBidDoc): VendorBidListRow {
  const rawStatus = (typeof doc.status === 'string' ? doc.status : 'submitted').toLowerCase();
  const idStr = String(doc._id);
  // The Rust DTO doesn't carry an explicit human bid-number; use the
  // last 6 of the ObjectId so the list still has a stable handle.
  const bidNo = `VB-${idStr.slice(-6).toUpperCase()}`;
  return {
    _id: idStr,
    bidNo,
    vendorId: doc.vendorId,
    vendorName: doc.vendorName,
    rfqId: doc.rfqId,
    submittedAt: doc.submittedAt ?? doc.createdAt ?? doc.audit?.createdAt,
    currency: doc.currency,
    total: doc.totals?.total,
    budget: doc.totals?.total ? doc.totals.total * 1.15 : undefined,
    leadTimeDays: maxLeadTime(doc.items),
    status: rawStatus,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
  };
}

function computeKpi(rows: VendorBidListRow[]): VendorBidKpiSummary {
  let draft = 0;
  let submitted = 0;
  let shortlisted = 0;
  let awarded = 0;
  let rejected = 0;
  for (const r of rows) {
    // The Rust DTO doesn't model `draft` directly; bids land on the
    // server as `submitted`. We surface a `draft` bucket for parity
    // with §1D and to make room for a future client-side draft flow.
    if (r.status === 'draft') draft += 1;
    else if (r.status === 'submitted') submitted += 1;
    else if (r.status === 'shortlisted') shortlisted += 1;
    else if (r.status === 'awarded') awarded += 1;
    else if (r.status === 'rejected') rejected += 1;
  }
  return { draft, submitted, shortlisted, awarded, rejected };
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function VendorBidsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  const { bids, hasMore, error } = await listVendorBids({
    page,
    limit,
    q: q || undefined,
  });

  const rows = bids.map(toRow);
  const kpi = computeKpi(rows);

  return (
    <EntityListShell
      title="Vendor Bids"
      subtitle="Vendor responses to your RFQs — submitted, shortlisted, awarded, rejected."
    >
      <VendorBidListClient
        bids={rows}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        kpi={kpi}
        defaultCurrency="INR"
        error={error}
      />
    </EntityListShell>
  );
}
