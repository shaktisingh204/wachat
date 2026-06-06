import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import React, { Suspense } from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { statusToTone } from '@/components/crm/status-pill';
import { getRfq } from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqLineItem } from '@/lib/rust-client/crm-rfqs';
import { fmtDate, fmtINR } from '@/lib/utils';

import { RfqDetailActions } from '../_components/rfq-detail-actions';
import { RfqQuickEdits } from '../_components/rfq-quick-edits';
import { RfqVendorBidsCard } from '../_components/rfq-vendor-bids-card';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

const STATUS_FLOW = ['draft', 'open', 'closed', 'awarded'] as const;
const TERMINAL_STATUSES = new Set(['cancelled']);

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

export default async function RfqDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { rfq, error } = await getRfq(id);

  if (!rfq) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this RFQ — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/rfqs">
              <ArrowLeft className="h-4 w-4" /> Back to RFQs
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const rfqId = String(rfq._id);
  const status = (typeof rfq.status === 'string' ? rfq.status : 'draft').toLowerCase();
  const items: CrmRfqLineItem[] = rfq.items ?? [];
  const vendors = rfq.vendorsInvited ?? [];
  const attachments = rfq.attachments ?? [];
  const ownerId = rfq.audit?.createdBy ?? null;

  const title = rfq.title || `RFQ ${rfqId.slice(-6)}`;
  const subtitle = `${vendors.length} vendor${vendors.length === 1 ? '' : 's'} invited`;

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`RFQ ${rfq.title ?? rfqId.slice(-6)}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{ href: '/dashboard/crm/purchases/rfqs', label: 'All RFQs' }}
      actions={
        <RfqDetailActions
          rfqId={rfqId}
          status={status}
          rfqTitle={rfq.title || ''}
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

          {/* Quick edits */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>At a glance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <RfqQuickEdits rfqId={rfqId} ownerId={ownerId} status={status} />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Required by</span>
                  <span>{fmtDate(rfq.requiredBy)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Deadline</span>
                  <span>{fmtDate(rfq.deadline)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Created</span>
                  <span>{fmtDate(rfq.createdAt || rfq.audit?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Updated</span>
                  <span>{fmtDate(rfq.updatedAt || rfq.audit?.updatedAt)}</span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          <LineageRail
            current={{
              kind: 'rfq',
              id: rfqId,
              no: rfq.title,
              status,
            }}
            lineage={[]}
          />

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link href={`/dashboard/crm/purchases/rfqs/${rfqId}/activity`}>
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <EntityAuditTimeline entityKind="rfq" entityId={rfqId} />
        </Suspense>
      }
    >
      <p className="text-[12.5px] text-[var(--st-text-secondary)]">{subtitle}</p>

      {/* Overview */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Title">{rfq.title || '—'}</DetailField>
            <DetailField label="Status">
              <Badge variant="secondary">{status}</Badge>
            </DetailField>
            <DetailField label="Required by">{fmtDate(rfq.requiredBy)}</DetailField>
            <DetailField label="Submission deadline">{fmtDate(rfq.deadline)}</DetailField>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Vendors invited */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Vendors invited</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {vendors.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No vendors invited yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {vendors.map((vid) => (
                <EntityPickerChip key={vid} entity="vendor" id={vid} />
              ))}
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Line items */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Line items</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {items.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">No line items.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-[var(--st-border)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Specs / notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li, idx) => (
                    <tr
                      key={`${li.itemId ?? 'row'}-${idx}`}
                      className="border-t border-[var(--st-border)]"
                    >
                      <td className="p-2">
                        {li.itemId ? (
                          <EntityPickerChip entity="item" id={li.itemId} />
                        ) : (
                          <span className="text-[var(--st-text)]">—</span>
                        )}
                      </td>
                      <td className="p-2 text-[var(--st-text)]">
                        {li.description || '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {li.qty ?? '—'}
                      </td>
                      <td className="p-2 text-[var(--st-text-secondary)]">
                        {li.unit || '—'}
                      </td>
                      <td className="p-2 text-[var(--st-text-secondary)]">
                        {li.specs || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Vendor bids received */}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <RfqVendorBidsCard rfqId={rfqId} />
      </Suspense>

      {/* Terms */}
      {rfq.terms ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Terms</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {rfq.terms}
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
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
