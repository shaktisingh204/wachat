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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listRfqs } from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqDoc } from '@/lib/rust-client/crm-rfqs';

import { RfqListClient } from './_components/rfq-list-client';
import type { RfqKpiSummary, RfqListRow } from './_components/types';

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
  // Owner / currency / estimated value aren't first-class on the RFQ
  // wire shape yet — read them out of audit/identity + a customFields
  // bag when present so the new columns can hydrate gradually.
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
    deadline: doc.deadline,
    requiredBy: doc.requiredBy,
    currency,
    estimatedValue,
    status: rawStatus,
    ownerId,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
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
    // "Awaiting responses" = open RFQs with an unexpired deadline. If
    // the deadline isn't set, count it (vendors are still expected to
    // respond) — matches the open-list semantics.
    if (r.status === 'open' && !r.deadlinePassed) {
      awaitingResponses += 1;
    }
    // Avg response time proxy: hours between createdAt and updatedAt for
    // rows that have moved off draft. Skips rows still in draft and rows
    // missing either timestamp.
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

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function RfqsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  const { rfqs, hasMore, error } = await listRfqs({
    page,
    limit,
    q: q || undefined,
  });

  const rows = rfqs.map(toRow);
  const kpi = computeKpi(rows);

  return (
    <EntityListShell
      title="Request for Quotations"
      subtitle="Issue RFQs to vendors and award the winning bid — draft, open, closed, awarded, cancelled."
    >
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
    </EntityListShell>
  );
}
