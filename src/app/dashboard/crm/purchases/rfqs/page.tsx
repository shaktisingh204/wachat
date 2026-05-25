/**
 * Canonical RFQs list — `/dashboard/crm/purchases/rfqs`.
 *
 * Server component. Reads page/limit/q from the URL, fetches via the
 * canonical (Rust-backed) `listRfqs` action, then projects each
 * `CrmRfqDoc` into the `RfqListRow` wire shape the client islands
 * consume. KPI strip values are computed in the same pass so the
 * client doesn't need a follow-up round trip.
 *
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D — purchase-side mirror
 * of the canonical Quotations module.
 */

import React, { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listRfqs } from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqDoc } from '@/lib/rust-client/crm-rfqs';

import { RfqListClient } from './_components/rfq-list-client';
import type { RfqKpiSummary, RfqListRow } from './_components/types';
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

function isDeadlinePassed(doc: CrmRfqDoc): boolean {
  if (!doc.deadline) return false;
  const v = new Date(doc.deadline).getTime();
  if (Number.isNaN(v)) return false;
  return v < Date.now();
}

function toRow(doc: CrmRfqDoc): RfqListRow {
  const rawStatus = (typeof doc.status === 'string' ? doc.status : 'draft').toLowerCase();
  const invited = Array.isArray(doc.vendorsInvited) ? doc.vendorsInvited.length : 0;
  const anyDoc = doc as unknown as Record<string, unknown>;
  const customFields = (anyDoc.customFields ?? {}) as Record<string, unknown>;
  const estimatedRaw = customFields._estimatedValue;
  const estimatedValue =
    typeof estimatedRaw === 'number' && Number.isFinite(estimatedRaw)
      ? estimatedRaw
      : undefined;
  const currency =
    typeof anyDoc.currency === 'string' && anyDoc.currency
      ? (anyDoc.currency as string)
      : typeof customFields._currency === 'string'
        ? (customFields._currency as string)
        : undefined;
  const ownerId =
    (anyDoc.ownerId as string | null | undefined) ??
    doc.audit?.createdBy ??
    null;
  return {
    _id: String(doc._id),
    title: doc.title || '',
    vendorsInvitedCount: invited,
    deadline: doc.deadline ? new Date(doc.deadline).toISOString() : undefined,
    requiredBy: doc.requiredBy ? new Date(doc.requiredBy).toISOString() : undefined,
    currency,
    estimatedValue,
    status: rawStatus,
    ownerId,
    createdAt: (doc.createdAt ?? doc.audit?.createdAt) ? new Date(doc.createdAt ?? doc.audit?.createdAt).toISOString() : undefined,
    updatedAt: (doc.updatedAt ?? doc.audit?.updatedAt) ? new Date(doc.updatedAt ?? doc.audit?.updatedAt).toISOString() : undefined,
    deadlinePassed: isDeadlinePassed(doc),
  };
}

function computeKpi(rows: RfqListRow[]): RfqKpiSummary {
  let draft = 0;
  let open = 0;
  let closed = 0;
  let awarded = 0;
  let cancelled = 0;
  let awaitingResponses = 0;
  let responseHoursTotal = 0;
  let responseHoursCount = 0;
  for (const r of rows) {
    if (r.status === 'draft') draft += 1;
    else if (r.status === 'open') open += 1;
    else if (r.status === 'closed') closed += 1;
    else if (r.status === 'awarded') awarded += 1;
    else if (r.status === 'cancelled') cancelled += 1;
    if (r.status === 'open' && !r.deadlinePassed) {
      awaitingResponses += 1;
    }
    if (
      r.status !== 'draft' &&
      r.createdAt &&
      r.updatedAt &&
      r.createdAt !== r.updatedAt
    ) {
      const c = new Date(r.createdAt).getTime();
      const u = new Date(r.updatedAt).getTime();
      if (!Number.isNaN(c) && !Number.isNaN(u) && u >= c) {
        responseHoursTotal += (u - c) / 3_600_000;
        responseHoursCount += 1;
      }
    }
  }
  return {
    draft,
    open,
    closed,
    awarded,
    cancelled,
    awaitingResponses,
    avgResponseHours:
      responseHoursCount > 0 ? responseHoursTotal / responseHoursCount : null,
    totalActive: open,
  };
}

/* ─── Server Container ────────────────────────────────────────────── */

async function RfqListContainer({ page, limit, q }: { page: number; limit: number; q: string }) {
  const { rfqs, hasMore, error } = await listRfqs({
    page,
    limit,
    q: q || undefined,
  });

  if (error) {
    throw new Error(error);
  }

  const rows = rfqs.map(toRow);
  const kpi = computeKpi(rows);

  return (
    <RfqListClient
      rfqs={rows}
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

export default async function RfqsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  return (
    <EntityListShell
      title="Request for Quotations"
      subtitle="Issue RFQs to vendors and award the winning bid — draft, open, closed, awarded, cancelled."
    >
      <Suspense fallback={<PurchasesLoading />}>
        <RfqListContainer page={page} limit={limit} q={q} />
      </Suspense>
    </EntityListShell>
  );
}
