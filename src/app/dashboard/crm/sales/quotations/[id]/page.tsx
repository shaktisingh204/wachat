/**
 * Canonical Quotation detail — `/dashboard/crm/sales/quotations/[id]`.
 *
 * Server component. Loads the quotation via the canonical
 * `getQuotation` action, then assembles the §1D.2 detail surface:
 *   - Header: clickable status pill (status-change dropdown) + core
 *     action group (Edit · Send · Convert to Invoice · Email · Print
 *     · Archive · Activity). The remaining §1D actions (Convert to SO
 *     / Proforma · Duplicate · WhatsApp) are documented as TODOs in
 *     `<QuotationDetailActions>` per the scope-cap rule.
 *   - Body cards: Overview, Customer, Line items, Money summary,
 *     Terms, Notes composer + chronological list, Attachments, Tags.
 *   - Right rail: LineageRail (current = quotation), status-flow
 *     visualizer (draft→sent→accepted/rejected/expired→converted),
 *     quick-edit chips (sales agent + status), at-a-glance dates.
 *   - Footer: `<EntityAuditTimeline entityKind="quotation">`.
 *   - `?print=1` renders a clean single-column print layout.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList, FileText, Receipt, ShoppingCart } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import {
  getCrmQuotationRelatedCounts,
  getQuotation,
} from '@/app/actions/crm/quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { CrmQuotationLineItem } from '@/lib/rust-client/crm-quotations';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

import { QuotationDetailActions } from '../_components/quotation-detail-actions';
import { QuotationPrintView } from '../_components/quotation-print-view';
import { QuotationQuickEdits } from '../_components/quotation-quick-edits';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
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

const STATUS_FLOW = ['draft', 'sent', 'accepted', 'converted'] as const;
const TERMINAL_STATUSES = new Set(['rejected', 'expired']);

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

export default async function QuotationDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const printMode = sp?.print === '1';

  const [{ quotation, error }, customFields, relatedCounts] = await Promise.all([
    getQuotation(id),
    getCustomFieldsFor('quotation') as Promise<WsCustomField[]>,
    getCrmQuotationRelatedCounts(id),
  ]);

  if (!quotation) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this quotation — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/sales/quotations">
              <ArrowLeft className="h-4 w-4" /> Back to Quotations
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const quotationId = String(quotation._id);
  const status = (quotation.status ?? 'draft').toLowerCase();
  const cfValues = (quotation.customFields ?? {}) as Record<string, unknown>;
  const items: CrmQuotationLineItem[] = quotation.items ?? [];
  const totals = quotation.totals ?? { subTotal: 0, total: 0 };
  const currency = quotation.currency ?? 'INR';
  const salesAgentId =
    quotation.assignment?.assignedTo ?? quotation.salesAgentId ?? null;

  /* ─── Print mode ────────────────────────────────────────────── */

  if (printMode) {
    return <QuotationPrintView quotation={quotation} />;
  }

  /* ─── Standard detail surface ─────────────────────────────── */

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/sales/quotations"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Quotations
        </Link>
        <CrmPageHeader
          title={`Quotation ${quotation.quotationNo}`}
          subtitle={`${fmtMoney(totals.total, currency)} · ${status}`}
          icon={FileText}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Sales', href: '/dashboard/crm/sales' },
            { label: 'Quotations', href: '/dashboard/crm/sales/quotations' },
            { label: quotation.quotationNo },
          ]}
        />
        <QuotationDetailActions
          quotationId={quotationId}
          status={status}
          quotationNo={quotation.quotationNo}
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
              <DetailField label="Quotation #">{quotation.quotationNo}</DetailField>
              <DetailField label="Status">
                <ZoruBadge variant="secondary">{status}</ZoruBadge>
              </DetailField>
              <DetailField label="Date">{fmtDate(quotation.date)}</DetailField>
              <DetailField label="Valid until">{fmtDate(quotation.validUntil)}</DetailField>
              <DetailField label="Currency">{currency}</DetailField>
              <DetailField label="Place of supply">
                {quotation.placeOfSupply || '—'}
              </DetailField>
              <DetailField label="Subject">{quotation.subject || '—'}</DetailField>
              <DetailField label="Reference #">
                {quotation.referenceNo || '—'}
              </DetailField>
            </div>
          </ZoruCard>

          {/* Customer */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Customer
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailField label="Customer">
                {quotation.clientId ? (
                  <EntityPickerChip entity="client" id={quotation.clientId} />
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Sales agent">
                {salesAgentId ? (
                  <EntityPickerChip entity="user" id={salesAgentId} />
                ) : (
                  '—'
                )}
              </DetailField>
              <DetailField label="Source deal">
                {quotation.dealId ? (
                  <EntityPickerChip entity="deal" id={quotation.dealId} />
                ) : (
                  '—'
                )}
              </DetailField>
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
                      <th className="p-2 text-right">Tax %</th>
                      <th className="p-2 text-right">Amount</th>
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
                            <span className="text-zoru-ink">
                              {li.description || '—'}
                            </span>
                          )}
                          {li.itemId && li.description ? (
                            <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                              {li.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                          {li.qty}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                          {fmtMoney(li.rate, currency)}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink-muted">
                          {typeof li.taxRatePct === 'number' ? `${li.taxRatePct}%` : '—'}
                        </td>
                        <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                          {fmtMoney(li.total, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ZoruCard>

          {/* Money summary */}
          <ZoruCard className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Money summary
            </h2>
            <dl className="grid gap-2 md:grid-cols-2 text-[13px]">
              <div className="flex justify-between md:col-start-2">
                <span className="text-zoru-ink-muted">Subtotal</span>
                <span className="font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(totals.subTotal, currency)}
                </span>
              </div>
              {typeof totals.discountOverall === 'number' ? (
                <div className="flex justify-between md:col-start-2">
                  <span className="text-zoru-ink-muted">Discount</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    −{fmtMoney(totals.discountOverall, currency)}
                  </span>
                </div>
              ) : null}
              {typeof totals.shippingCharge === 'number' ? (
                <div className="flex justify-between md:col-start-2">
                  <span className="text-zoru-ink-muted">Shipping</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {fmtMoney(totals.shippingCharge, currency)}
                  </span>
                </div>
              ) : null}
              {typeof totals.adjustment === 'number' ? (
                <div className="flex justify-between md:col-start-2">
                  <span className="text-zoru-ink-muted">Adjustment</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {fmtMoney(totals.adjustment, currency)}
                  </span>
                </div>
              ) : null}
              {typeof totals.roundOff === 'number' ? (
                <div className="flex justify-between md:col-start-2">
                  <span className="text-zoru-ink-muted">Round-off</span>
                  <span className="font-mono tabular-nums text-zoru-ink">
                    {fmtMoney(totals.roundOff, currency)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-zoru-line pt-2 md:col-start-2">
                <span className="font-medium text-zoru-ink">Total</span>
                <span className="font-medium font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(totals.total, currency)}
                </span>
              </div>
            </dl>
          </ZoruCard>

          {/* Terms */}
          {quotation.termsAndConditions ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Terms &amp; conditions
              </h2>
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {quotation.termsAndConditions}
              </p>
            </ZoruCard>
          ) : null}

          {/* Notes (chronological). Until the canonical CRM-notes
              composer lifts to `quotation` records, surface the
              persisted `customerNotes` here. */}
          <ZoruCard className="p-6">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Notes
            </h2>
            {quotation.customerNotes ? (
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {quotation.customerNotes}
              </p>
            ) : (
              <p className="text-[13px] text-zoru-ink-muted">
                No notes yet — add them via the Edit form.
              </p>
            )}
          </ZoruCard>

          {/* Attachments — placeholder list. Files come from SabFiles per
              `<QuotationForm>`; the wire-shape on the Rust DTO doesn't
              surface them yet, so we render the URL stash if present in
              the customFields bag. */}
          {Array.isArray((cfValues._attachments as unknown) as string[]) ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Attachments
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-zoru-ink">
                {(cfValues._attachments as string[]).map((u) => (
                  <li key={u}>
                    <a className="hover:underline" href={u} target="_blank" rel="noopener noreferrer">
                      {u.split('/').pop()}
                    </a>
                  </li>
                ))}
              </ul>
            </ZoruCard>
          ) : null}

          {/* Tags — surfaced from customFields when present (no first-
              class tag column on the Rust DTO yet). */}
          {Array.isArray((cfValues._tags as unknown) as string[]) ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {(cfValues._tags as string[]).map((t) => (
                  <ZoruBadge key={t} variant="outline">
                    {t}
                  </ZoruBadge>
                ))}
              </div>
            </ZoruCard>
          ) : null}

          {customFields.length > 0 ? (
            <ZoruCard className="p-6">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Custom fields
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {customFields.map((f) => (
                  <DetailField key={String(f._id ?? f.name)} label={f.label || f.name}>
                    <CustomFieldDisplay
                      field={f}
                      value={
                        cfValues[f.name] as Parameters<typeof CustomFieldDisplay>[0]['value']
                      }
                    />
                  </DetailField>
                ))}
              </div>
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
              <QuotationQuickEdits
                quotationId={quotationId}
                salesAgentId={salesAgentId}
                status={status}
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>{fmtDate(quotation.createdAt || quotation.audit?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>{fmtDate(quotation.updatedAt || quotation.audit?.updatedAt)}</span>
                </div>
              </div>
            </ZoruCard>

            {/* Lineage rail */}
            <LineageRail
              current={{
                kind: 'quotation',
                id: quotationId,
                no: quotation.quotationNo,
                status,
              }}
              lineage={[]}
            />

            {/* Related entities */}
            <RelatedRail
              items={[
                {
                  label: 'Sales orders',
                  count: relatedCounts.salesOrders,
                  icon: <ShoppingCart className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/sales/orders?quotationId=${quotationId}`,
                },
                {
                  label: 'Invoices',
                  count: relatedCounts.invoices,
                  icon: <Receipt className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/sales/invoices?quotationId=${quotationId}`,
                },
              ]}
            />

            <ZoruButton size="sm" variant="ghost" asChild className="w-full">
              <Link href={`/dashboard/crm/sales/quotations/${quotationId}/activity`}>
                <ClipboardList className="h-3.5 w-3.5" />
                View full activity log
              </Link>
            </ZoruButton>
          </div>
        </aside>
      </div>

      {/* Audit footer */}
      <EntityAuditTimeline entityKind="quotation" entityId={quotationId} />
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

