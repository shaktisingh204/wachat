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

import { getQuotationKpis, listQuotations } from '@/app/actions/crm/quotations.actions';
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
  let draft = 0;
  let totalThisMonth = 0;
  let totalQuotedValue = 0;
  let currency = 'INR';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  for (const r of rows) {
    if (r.status === 'draft') draft += 1;
    if (r.status === 'draft' || r.status === 'sent') totalOpen += 1;
    if (r.status === 'accepted') accepted += 1;
    if (r.status === 'rejected') rejected += 1;
    if (r.expired) expired += 1;
    if (r.status === 'converted') converted += 1;
    if (r.currency) currency = r.currency;
    if (typeof r.total === 'number') totalQuotedValue += r.total;
    if (typeof r.date === 'string') {
      const t = new Date(r.date).getTime();
      if (!Number.isNaN(t) && t >= monthStart) totalThisMonth += 1;
    }
  }
  const conversionRatePct = rows.length > 0
    ? Math.round(((accepted + converted) / rows.length) * 1000) / 10
    : null;
  return {
    totalOpen,
    accepted,
    rejected,
    expired,
    conversionRatePct,
    draft,
    totalThisMonth,
    totalQuotedValue: Math.round(totalQuotedValue),
    currency,
  };
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function QuotationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 50), 200);
  const q = (sp.q ?? '').trim();

  const [listRes, snapshot] = await Promise.all([
    listQuotations({ page, limit, q: q || undefined }),
    getQuotationKpis(),
  ]);
  const { quotations, hasMore, error } = listRes;

  const rows = quotations.map(toRow);
  const pageKpi = computeKpi(rows);
  // Prefer the broader 200-row snapshot's MTD + value totals over the
  // per-page numbers, but keep status counts from whichever yields more
  // signal.
  const kpi: QuotationKpiSummary = {
    ...pageKpi,
    totalOpen: snapshot.totalOpen || pageKpi.totalOpen,
    accepted: snapshot.accepted || pageKpi.accepted,
    rejected: snapshot.rejected || pageKpi.rejected,
    expired: snapshot.expired || pageKpi.expired,
    draft: snapshot.draft || pageKpi.draft,
    conversionRatePct:
      snapshot.conversionRatePct !== null
        ? snapshot.conversionRatePct
        : pageKpi.conversionRatePct,
    totalThisMonth: snapshot.totalThisMonth || pageKpi.totalThisMonth,
    totalQuotedValue: snapshot.totalQuotedValue || pageKpi.totalQuotedValue,
    currency: snapshot.currency || pageKpi.currency,
  };

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
