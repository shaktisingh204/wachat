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

import React, { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listVendorBids } from '@/app/actions/crm/vendor-bids.actions';
import type { CrmVendorBidDoc } from '@/lib/rust-client/crm-vendor-bids';

import { VendorBidListClient } from './_components/vendor-bid-list-client';
import type {
  VendorBidKpiSummary,
  VendorBidListRow,
} from './_components/types';
import PurchasesLoading from '../loading';

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

/**
 * Normalize an id field coming off the Rust BFF.
 *
 * The vendor-bid handler returns a typed `VendorBid` whose `_id`,
 * `rfqId`, and `vendorId` are `ObjectId`s — serde serializes those as
 * MongoDB extended JSON (`{ "$oid": "<hex>" }`), NOT a bare string. A
 * naive `String(value)` on that object yields `"[object Object]"`, so
 * we unwrap the `$oid` form (and tolerate plain strings / nullish).
 */
function normId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '$oid' in (value as Record<string, unknown>)) {
    const oid = (value as { $oid?: unknown }).$oid;
    return typeof oid === 'string' ? oid : '';
  }
  return String(value);
}

/**
 * Normalize a date field coming off the Rust BFF into an ISO string.
 *
 * `submittedAt` and the `audit.*` timestamps serialize through bson's
 * `chrono_datetime_as_bson_datetime`, which emits extended JSON —
 * either `{ "$date": "<iso>" }` or `{ "$date": { "$numberLong": "<ms>" } }`.
 * Feeding that object straight into `new Date(...).toISOString()` produces
 * an `Invalid Date` and `.toISOString()` then throws `RangeError: Invalid
 * time value`, crashing the whole Server Component render. We unwrap the
 * known shapes and guard validity, returning `undefined` for anything we
 * can't parse rather than throwing.
 */
function normDate(...candidates: unknown[]): string | undefined {
  for (const raw of candidates) {
    if (raw == null) continue;
    let input: string | number | Date | null = null;
    if (raw instanceof Date) {
      input = raw;
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      input = raw;
    } else if (typeof raw === 'object') {
      const inner = (raw as { $date?: unknown }).$date;
      if (typeof inner === 'string' || typeof inner === 'number') {
        input = inner;
      } else if (
        inner != null &&
        typeof inner === 'object' &&
        '$numberLong' in (inner as Record<string, unknown>)
      ) {
        const ms = Number((inner as { $numberLong?: unknown }).$numberLong);
        if (Number.isFinite(ms)) input = ms;
      }
    }
    if (input == null) continue;
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

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
  const idStr = normId(doc._id);
  const bidNo = `VB-${idStr.slice(-6).toUpperCase()}`;
  return {
    _id: idStr,
    bidNo,
    vendorId: normId(doc.vendorId),
    vendorName: doc.vendorName,
    rfqId: normId(doc.rfqId) || undefined,
    submittedAt: normDate(doc.submittedAt, doc.createdAt, doc.audit?.createdAt),
    currency: doc.currency,
    total: doc.totals?.total,
    budget: doc.totals?.total ? doc.totals.total * 1.15 : undefined,
    leadTimeDays: maxLeadTime(doc.items),
    status: rawStatus,
    createdAt: normDate(doc.createdAt, doc.audit?.createdAt),
    updatedAt: normDate(doc.updatedAt, doc.audit?.updatedAt),
  };
}

function computeKpi(rows: VendorBidListRow[]): VendorBidKpiSummary {
  let draft = 0;
  let submitted = 0;
  let shortlisted = 0;
  let awarded = 0;
  let rejected = 0;
  for (const r of rows) {
    if (r.status === 'draft') draft += 1;
    else if (r.status === 'submitted') submitted += 1;
    else if (r.status === 'shortlisted') shortlisted += 1;
    else if (r.status === 'awarded') awarded += 1;
    else if (r.status === 'rejected') rejected += 1;
  }
  return { draft, submitted, shortlisted, awarded, rejected };
}

/* ─── Server Container ────────────────────────────────────────────── */

async function VendorBidListContainer({ page, limit, q }: { page: number; limit: number; q: string }) {
  const { bids, hasMore, error } = await listVendorBids({
    page,
    limit,
    q: q || undefined,
  });

  // NB: a BFF error is recoverable — `listVendorBids` already catches and
  // returns `{ error }` with an empty `bids[]`. Render the client's
  // dedicated error banner (it accepts `error`) instead of throwing, which
  // would crash the entire Server Component render with an opaque digest.
  const rows = bids.map(toRow);
  const kpi = computeKpi(rows);

  return (
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
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function VendorBidsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  return (
    <EntityListShell
      title="Vendor Bids"
      subtitle="Vendor responses to your RFQs — submitted, shortlisted, awarded, rejected."
    >
      <Suspense fallback={<PurchasesLoading />}>
        <VendorBidListContainer page={page} limit={limit} q={q} />
      </Suspense>
    </EntityListShell>
  );
}
