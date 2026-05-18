/**
 * Canonical Quotations list — `/dashboard/crm/sales/quotations`.
 *
 * Server component. Reads page/limit/q from the URL, fetches the rows
 * via the canonical (Rust-backed) `listQuotations` action, then
 * projects each `CrmQuotationDoc` into the `QuotationListRow` wire
 * shape the client islands consume. KPI strip values are computed in
 * the same pass so the client doesn't need a follow-up round trip.
 *
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D.
 */

import { listQuotations } from '@/app/actions/crm/quotations.actions';
import type { CrmQuotationDoc } from '@/lib/rust-client/crm-quotations';

import { QuotationListClient } from './_components/quotation-list-client';
import type { QuotationKpiSummary, QuotationListRow } from './_components/types';

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

function isExpired(doc: CrmQuotationDoc): boolean {
  if (!doc.validUntil) return false;
  const v = new Date(doc.validUntil).getTime();
  if (Number.isNaN(v)) return false;
  return v < Date.now();
}

function toRow(doc: CrmQuotationDoc): QuotationListRow {
  const rawStatus = (doc.status ?? 'draft').toLowerCase();
  const expired = rawStatus === 'expired' || isExpired(doc);
  return {
    _id: String(doc._id),
    quotationNo: doc.quotationNo,
    subject: doc.subject,
    clientId: doc.clientId ?? null,
    date: doc.date,
    validUntil: doc.validUntil,
    currency: doc.currency,
    total: doc.totals?.total,
    status: rawStatus,
    salesAgentId:
      doc.assignment?.assignedTo ?? doc.salesAgentId ?? null,
    createdAt: doc.createdAt ?? doc.audit?.createdAt,
    updatedAt: doc.updatedAt ?? doc.audit?.updatedAt,
    expired,
  };
}

function computeKpi(rows: QuotationListRow[]): QuotationKpiSummary {
  let totalOpen = 0;
  let accepted = 0;
  let rejected = 0;
  let expired = 0;
  let converted = 0;
  for (const r of rows) {
    if (r.status === 'draft' || r.status === 'sent') totalOpen += 1;
    if (r.status === 'accepted') accepted += 1;
    if (r.status === 'rejected') rejected += 1;
    if (r.expired) expired += 1;
    if (r.status === 'converted') converted += 1;
  }
  const conversionRatePct = rows.length > 0
    ? Math.round(((accepted + converted) / rows.length) * 1000) / 10
    : null;
  return { totalOpen, accepted, rejected, expired, conversionRatePct };
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function QuotationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  const { quotations, hasMore, error } = await listQuotations({
    page,
    limit,
    q: q || undefined,
  });

  const rows = quotations.map(toRow);
  const kpi = computeKpi(rows);

  return (
    <QuotationListClient
      quotations={rows}
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
