import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ArrowLeft,
  ClipboardList } from 'lucide-react';

/**
 * Vendor Bid detail — `/dashboard/crm/purchases/vendor-bids/[id]`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2).
 *
 * Server component. Lifted onto the canonical `<EntityDetailShell>` so
 * the header / body / right-rail / audit-footer composition matches the
 * Invoices template.
 *
 * Header: back link + eyebrow + status pill + action group
 * (Edit · Accept · Reject · Counter-offer · Convert to PO · Print ·
 * Archive · Activity — see <VendorBidDetailActions>).
 * Body: overview, line items, pricing summary, terms, attachments.
 * Right rail: status-flow visualizer (submitted → shortlisted →
 * awarded) · at-a-glance dates · LineageRail (RFQ → bid).
 * Audit footer: <EntityAuditTimeline entityKind="vendorBid">.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { statusToTone } from '@/components/crm/status-pill';
import { getVendorBid } from '@/app/actions/crm/vendor-bids.actions';

import { VendorBidDetailActions } from '../_components/vendor-bid-detail-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ─── Helpers (module-level hoist) ────────────────────────────────── */

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

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
    </div>
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
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/vendor-bids">
              <ArrowLeft className="h-4 w-4" /> Back to Vendor Bids
            </Link>
          </Button>
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
    <EntityDetailShell
      title={bidLabel}
      eyebrow={`VENDOR BID ${bidId.slice(-6).toUpperCase()}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{
        href: '/dashboard/crm/purchases/vendor-bids',
        label: 'All vendor bids',
      }}
      actions={
        <VendorBidDetailActions
          bidId={bidId}
          status={status}
          bidLabel={bidLabel}
        />
      }
      rightRail={
        <>
          {/* Status flow visualizer */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Status flow</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <ol className="space-y-1.5">
                {STATUS_FLOW.map((s) => (
                  <StatusStep key={s} status={s} current={status} />
                ))}
                {TERMINAL_STATUSES.has(status) ? (
                  <StatusStep status={status} current={status} />
                ) : null}
              </ol>
            </ZoruCardContent>
          </Card>

          {/* At-a-glance */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>At a glance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Submitted</span>
                  <span>{fmtDate(bid.submittedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(totals.total, currency)}
                  </span>
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
            </ZoruCardContent>
          </Card>

          <LineageRail
            current={{
              kind: 'vendorBid',
              id: bidId,
              no: bidLabel,
              status,
            }}
            lineage={bid.rfqId ? [{ kind: 'rfq', id: bid.rfqId }] : []}
          />

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link
              href={`/dashboard/crm/purchases/vendor-bids/${bidId}/activity`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={<EntityAuditTimeline entityKind="vendorBid" entityId={bidId} />}
    >
      <p className="text-[12.5px] text-zoru-ink-muted">
        {fmtMoney(totals.total, currency)}
      </p>

      {/* Overview */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Bid label">{bidLabel}</DetailField>
            <DetailField label="Status">
              <Badge variant="secondary">{status}</Badge>
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
        </ZoruCardContent>
      </Card>

      {/* Line items */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Line items</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
        </ZoruCardContent>
      </Card>

      {/* Pricing summary */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Pricing summary</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
        </ZoruCardContent>
      </Card>

      {/* Terms */}
      {bid.terms ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Terms</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {bid.terms}
            </p>
          </ZoruCardContent>
        </Card>
      ) : null}

      {/* Attachments */}
      {attachments.length > 0 ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Attachments</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
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
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
