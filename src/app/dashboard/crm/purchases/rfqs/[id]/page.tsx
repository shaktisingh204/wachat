/**
 * Canonical RFQ detail — `/dashboard/crm/purchases/rfqs/[id]`.
 *
 * Server component. Loads the RFQ via the canonical `getRfq` action,
 * then assembles the §1D detail surface (purchase-side mirror of the
 * canonical Quotation detail):
 *   - Header: clickable status pill (status-change dropdown) + 8-action
 *     group (Edit · Send to vendors · Close · Award · Convert to PO ·
 *     Print · Archive · Activity).
 *   - Body cards: Overview, Vendors invited, Line items, Vendor bids
 *     received (with awarded vendor highlighted), Terms, Attachments.
 *   - Right rail: LineageRail (purchase chain), status-flow visualizer
 *     (draft → open → closed → awarded / cancelled), quick-edit chips,
 *     at-a-glance dates.
 *   - Footer: `<EntityAuditTimeline entityKind="rfq">`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { getRfq } from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqLineItem } from '@/lib/rust-client/crm-rfqs';

import { RfqDetailActions } from '../_components/rfq-detail-actions';
import { RfqQuickEdits } from '../_components/rfq-quick-edits';
import { RfqVendorBidsCard } from '../_components/rfq-vendor-bids-card';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function fmtDate(v?: string | Date | null): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
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

export default async function RfqDetailPage({ params }: PageProps) {
  const { id } = await params;

  const { rfq, error } = await getRfq(id);

  if (!rfq) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this RFQ — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/rfqs">
              <ArrowLeft className="h-4 w-4" /> Back to RFQs
            </Link>
          </ZoruButton>
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

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/purchases/rfqs"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to RFQs
        </Link>
        <CrmPageHeader
          title={rfq.title || 'RFQ'}
          subtitle={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'} invited · status ${status}`}
          icon={ClipboardList}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Purchases', href: '/dashboard/crm/purchases' },
            { label: 'RFQs', href: '/dashboard/crm/purchases/rfqs' },
            { label: rfq.title || 'RFQ' },
          ]}
        />
        <RfqDetailActions
          rfqId={rfqId}
          status={status}
          rfqTitle={rfq.title || ''}
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
              <DetailField label="Title">{rfq.title || '—'}</DetailField>
              <DetailField label="Status">
                <ZoruBadge variant="secondary">{status}</ZoruBadge>
              </DetailField>
              <DetailField label="Required by">{fmtDate(rfq.requiredBy)}</DetailField>
              <DetailField label="Submission deadline">{fmtDate(rfq.deadline)}</DetailField>
            </div>
          </ZoruCard>

          {/* Vendors invited */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Vendors invited
            </h2>
            {vendors.length === 0 ? (
              <p className="text-[13px] text-zoru-ink-muted">
                No vendors invited yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {vendors.map((vid) => (
                  <EntityPickerChip key={vid} entity="vendor" id={vid} />
                ))}
              </div>
            )}
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
                        className="border-t border-zoru-line"
                      >
                        <td className="p-2">
                          {li.itemId ? (
                            <EntityPickerChip entity="item" id={li.itemId} />
                          ) : (
                            <span className="text-zoru-ink">—</span>
                          )}
                        </td>
                        <td className="p-2 text-zoru-ink">
                          {li.description || '—'}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                          {li.qty ?? '—'}
                        </td>
                        <td className="p-2 text-zoru-ink-muted">
                          {li.unit || '—'}
                        </td>
                        <td className="p-2 text-zoru-ink-muted">
                          {li.specs || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ZoruCard>

          {/* Vendor bids received */}
          <RfqVendorBidsCard rfqId={rfqId} />

          {/* Terms */}
          {rfq.terms ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Terms
              </h2>
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {rfq.terms}
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

            {/* Quick edits */}
            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                At a glance
              </h3>
              <RfqQuickEdits
                rfqId={rfqId}
                ownerId={ownerId}
                status={status}
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Required by</span>
                  <span>{fmtDate(rfq.requiredBy)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Deadline</span>
                  <span>{fmtDate(rfq.deadline)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>{fmtDate(rfq.createdAt || rfq.audit?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>{fmtDate(rfq.updatedAt || rfq.audit?.updatedAt)}</span>
                </div>
              </div>
            </ZoruCard>

            {/* Lineage rail */}
            <LineageRail
              current={{
                kind: 'rfq',
                id: rfqId,
                no: rfq.title,
                status,
              }}
              lineage={[]}
            />
          </div>
        </aside>
      </div>

      {/* Audit footer */}
      <EntityAuditTimeline entityKind="rfq" entityId={rfqId} />
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
