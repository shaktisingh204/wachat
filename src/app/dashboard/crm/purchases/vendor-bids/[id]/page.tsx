/**
 * Canonical Vendor Bid detail — `/dashboard/crm/purchases/vendor-bids/[id]`.
 *
 * Server component. Loads the bid via the canonical `getVendorBid`
 * action, then assembles the §1D detail surface:
 *   - Header: clickable status pill (status-change dropdown) + 7-action
 *     group (Edit · Submit · Shortlist · Award · Reject · Convert to
 *     PO · Print · Archive · Activity).
 *   - Body cards: Overview, Pricing, Line items, Terms, Attachments.
 *   - Right rail: LineageRail (purchase chain), status-flow visualizer
 *     (submitted → shortlisted → awarded | rejected | withdrawn).
 *   - Footer: `<EntityAuditTimeline entityKind="vendorBid">`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Gavel } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { getVendorBid } from '@/app/actions/crm/vendor-bids.actions';

import { VendorBidDetailActions } from '../_components/vendor-bid-detail-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_FLOW = ['submitted', 'shortlisted', 'awarded'] as const;
const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn']);

interface StatusStepProps {
  status: string;
  current: string;
}

function StatusStep({ status, current }: StatusStepProps) {
  const isCurrent = status === current;
  return (
    <li
      className={`flex items-center gap-2 rounded px-2 py-1 text-[12.5px] ${
        isCurrent
          ? 'bg-zoru-surface-2 font-medium text-zoru-ink'
          : 'text-zoru-ink-muted'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          isCurrent ? 'bg-zoru-primary' : 'bg-zoru-line'
        }`}
        aria-hidden
      />
      {status}
      {isCurrent ? (
        <span className="ml-auto text-[10.5px] uppercase text-zoru-primary">
          current
        </span>
      ) : null}
    </li>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default async function VendorBidDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { bid, error } = await getVendorBid(id);

  if (!bid) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this vendor bid — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/vendor-bids">
              <ArrowLeft className="h-4 w-4" /> Back to Vendor Bids
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const bidId = String(bid._id);
  const status = (typeof bid.status === 'string' ? bid.status : 'submitted').toLowerCase();
  const currency = bid.currency || 'INR';
  const items = bid.items ?? [];
  const totals = bid.totals ?? { subTotal: 0, total: 0 };
  const bidLabel = bid.vendorName || `VB-${bidId.slice(-6).toUpperCase()}`;
  const attachments = bid.attachments ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/purchases/vendor-bids"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Vendor Bids
        </Link>
        <CrmPageHeader
          title={bidLabel}
          subtitle={`${fmtMoney(totals.total, currency)} · status ${status}`}
          icon={Gavel}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Purchases', href: '/dashboard/crm/purchases' },
            { label: 'Vendor Bids', href: '/dashboard/crm/purchases/vendor-bids' },
            { label: bidLabel },
          ]}
        />
        <VendorBidDetailActions
          bidId={bidId}
          status={status}
          bidLabel={bidLabel}
        />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Main column */}
        <main className="min-w-0 flex-1 space-y-6">
          {/* Overview */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Overview
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailField label="Bid label">{bidLabel}</DetailField>
              <DetailField label="Status">
                <ZoruBadge variant="secondary">{status}</ZoruBadge>
              </DetailField>
              <DetailField label="Vendor">
                {bid.vendorId ? (
                  <EntityPickerChip entity="vendor" id={bid.vendorId} />
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Related RFQ">
                {bid.rfqId ? (
                  <Link
                    href={`/dashboard/crm/purchases/rfqs/${bid.rfqId}`}
                    className="font-mono text-[12px] text-zoru-ink hover:underline"
                  >
                    {bid.rfqId}
                  </Link>
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Submitted at">
                {fmtDate(bid.submittedAt)}
              </DetailField>
              <DetailField label="Currency">{currency}</DetailField>
            </div>
          </ZoruCard>

          {/* Line items */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Line items
            </h2>
            {items.length === 0 ? (
              <p className="text-[13px] text-zoru-ink-muted">No line items.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-zoru-line">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Unit price</th>
                      <th className="p-2 text-right">Lead (days)</th>
                      <th className="p-2 text-left">Notes</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const qty = Number(it.qty) || 0;
                      const rate = Number(it.rate) || 0;
                      const total = qty * rate;
                      return (
                        <tr
                          key={idx}
                          className="border-t border-zoru-line text-zoru-ink"
                        >
                          <td className="p-2">
                            {it.itemId ? (
                              <EntityPickerChip entity="item" id={it.itemId} />
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </td>
                          <td className="p-2 text-right tabular-nums">{qty}</td>
                          <td className="p-2 text-right tabular-nums">
                            {fmtMoney(rate, currency)}
                          </td>
                          <td className="p-2 text-right tabular-nums text-zoru-ink-muted">
                            {typeof it.leadTimeDays === 'number'
                              ? it.leadTimeDays
                              : '—'}
                          </td>
                          <td className="p-2 text-zoru-ink-muted">
                            {it.notes || '—'}
                          </td>
                          <td className="p-2 text-right font-medium tabular-nums">
                            {fmtMoney(total, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ZoruCard>

          {/* Pricing summary */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Pricing summary
            </h2>
            <dl className="grid gap-2 md:grid-cols-2 text-[13px]">
              <div className="flex justify-between md:col-start-2">
                <span className="text-zoru-ink-muted">Sub-total</span>
                <span className="font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(totals.subTotal, currency)}
                </span>
              </div>
              <div className="flex justify-between border-t border-zoru-line pt-2 md:col-start-2">
                <span className="font-medium text-zoru-ink">Total</span>
                <span className="font-medium font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(totals.total, currency)}
                </span>
              </div>
            </dl>
          </ZoruCard>

          {/* Terms */}
          {bid.terms ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Terms
              </h2>
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {bid.terms}
              </p>
            </ZoruCard>
          ) : null}

          {/* Attachments */}
          {attachments.length > 0 ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Attachments
              </h2>
              <ul className="flex flex-col gap-1.5">
                {attachments.map((a, idx) => (
                  <li
                    key={`${a.fileId ?? 'att'}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zoru-line px-3 py-2 text-[12.5px]"
                  >
                    <span className="truncate text-zoru-ink">
                      {a.name || a.fileId || 'Attachment'}
                    </span>
                    {a.url ? (
                      <Link
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] text-zoru-ink-muted hover:underline"
                      >
                        Open
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ZoruCard>
          ) : null}
        </main>

        {/* Right rail */}
        <aside className="w-full md:w-80 md:shrink-0">
          <div className="space-y-4 md:sticky md:top-4">
            {/* Status flow visualizer */}
            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Status flow
              </h3>
              <ol className="space-y-1.5">
                {STATUS_FLOW.map((s) => (
                  <StatusStep key={s} status={s} current={status} />
                ))}
                {TERMINAL_STATUSES.has(status) ? (
                  <StatusStep status={status} current={status} />
                ) : null}
              </ol>
            </ZoruCard>

            {/* At-a-glance */}
            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                At a glance
              </h3>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Submitted</span>
                  <span>{fmtDate(bid.submittedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>{fmtDate(bid.createdAt || bid.audit?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>{fmtDate(bid.updatedAt || bid.audit?.updatedAt)}</span>
                </div>
              </div>
            </ZoruCard>

            {/* Lineage rail */}
            <LineageRail
              current={{
                kind: 'vendorBid',
                id: bidId,
                no: bidLabel,
                status,
              }}
              lineage={
                bid.rfqId
                  ? [{ kind: 'rfq', id: bid.rfqId }]
                  : []
              }
            />
          </div>
        </aside>
      </div>

      {/* Audit footer */}
      <EntityAuditTimeline entityKind="vendorBid" entityId={bidId} />
    </div>
  );
}

/* ─── Local presentational helpers ─────────────────────────────────── */

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
  );
}
