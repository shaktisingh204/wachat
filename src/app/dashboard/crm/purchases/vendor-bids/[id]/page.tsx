import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import React, { Suspense } from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { statusToTone } from '@/components/crm/status-pill';
import { getVendorBid } from '@/app/actions/crm/vendor-bids.actions';
import { fmtINR, fmtDate } from '@/lib/utils';
import PurchasesLoading from '../../loading';

import { VendorBidDetailActions } from '../_components/vendor-bid-detail-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
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
          ? 'bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]'
          : 'text-[var(--st-text-secondary)]'
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          isCurrent ? 'bg-[var(--st-text)]' : 'bg-[var(--st-border)]'
        }`}
        aria-hidden
      />
      {status}
      {isCurrent ? (
        <span className="ml-auto text-[10.5px] uppercase text-[var(--st-text)]">
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
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
          <p className="text-[14px] text-[var(--st-text)]">
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
            <CardHeader>
              <CardTitle>Status flow</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="space-y-1.5">
                {STATUS_FLOW.map((s) => (
                  <StatusStep key={s} status={s} current={status} />
                ))}
                {TERMINAL_STATUSES.has(status) ? (
                  <StatusStep status={status} current={status} />
                ) : null}
              </ol>
            </CardBody>
          </Card>

          {/* At-a-glance */}
          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Submitted</span>
                  <span>{fmtDate(bid.submittedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtINR(totals.total, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Created</span>
                  <span>{fmtDate(bid.createdAt || bid.audit?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Updated</span>
                  <span>{fmtDate(bid.updatedAt || bid.audit?.updatedAt)}</span>
                </div>
              </div>
            </CardBody>
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
      audit={
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <EntityAuditTimeline entityKind="vendorBid" entityId={bidId} />
        </Suspense>
      }
    >
      <p className="text-[12.5px] text-[var(--st-text-secondary)]">
        {fmtINR(totals.total, currency)}
      </p>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
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
                  className="font-mono text-[12px] text-[var(--st-text)] hover:underline"
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
        </CardBody>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">No line items.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-[var(--st-border)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
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
                        className="border-t border-[var(--st-border)] text-[var(--st-text)]"
                      >
                        <td className="p-2">
                          {it.itemId ? (
                            <div className="flex items-center gap-1.5">
                              <EntityPickerChip entity="item" id={it.itemId} />
                              {bid.rfqId && (
                                <Link
                                  href={`/dashboard/crm/purchases/rfqs/${bid.rfqId}#item-${it.itemId}`}
                                  className="text-[10px] text-[var(--st-text)] hover:underline whitespace-nowrap"
                                  title="View original RFQ item"
                                >
                                  (RFQ item)
                                </Link>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--st-text-secondary)]">—</span>
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">{qty}</td>
                        <td className="p-2 text-right tabular-nums">
                          {fmtINR(rate, currency)}
                        </td>
                        <td className="p-2 text-right tabular-nums text-[var(--st-text-secondary)]">
                          {typeof it.leadTimeDays === 'number'
                            ? it.leadTimeDays
                            : '—'}
                        </td>
                        <td className="p-2 text-[var(--st-text-secondary)]">
                          {it.notes || '—'}
                        </td>
                        <td className="p-2 text-right font-medium tabular-nums">
                          {fmtINR(total, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pricing summary */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing summary</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-2 md:grid-cols-2 text-[13px]">
            <div className="flex justify-between md:col-start-2">
              <span className="text-[var(--st-text-secondary)]">Sub-total</span>
              <span className="font-mono tabular-nums text-[var(--st-text)]">
                {fmtINR(totals.subTotal, currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[var(--st-border)] pt-2 md:col-start-2">
              <span className="font-medium text-[var(--st-text)]">Total</span>
              <span className="font-medium font-mono tabular-nums text-[var(--st-text)]">
                {fmtINR(totals.total, currency)}
              </span>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* Terms */}
      {bid.terms ? (
        <Card>
          <CardHeader>
            <CardTitle>Terms</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {bid.terms}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* Attachments */}
      {attachments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col gap-1.5">
              {attachments.map((a, idx) => (
                <li
                  key={`${a.fileId ?? 'att'}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--st-border)] px-3 py-2 text-[12.5px]"
                >
                  <span className="truncate text-[var(--st-text)]">
                    {a.name || a.fileId || 'Attachment'}
                  </span>
                  {a.url ? (
                    <Link
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-[var(--st-text-secondary)] hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
