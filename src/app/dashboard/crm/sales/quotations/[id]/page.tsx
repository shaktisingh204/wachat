/**
 * Canonical Quotation detail — `/dashboard/crm/sales/quotations/[id]`
 * (§1D.2 rebuild — Phase 1.1B Wave 2 partial).
 *
 * Server component. Wraps the existing detail body in the shared
 * <EntityDetailShell> per the §1D.5 bar. Header: status pill + eyebrow +
 * back link + 9-button action group. Main body: overview / customer /
 * line items / money summary / terms / notes / attachments / tags /
 * custom fields. Right rail: status flow visualizer · quick edits ·
 * <LineageRail> · related counts · activity link. Footer:
 * <EntityAuditTimeline entityKind="quotation">.
 *
 * Mirrors the ACCOUNTS template at
 * `src/app/dashboard/crm/accounts/[accountId]/page.tsx`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList, Receipt, ShoppingCart } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { statusToTone } from '@/components/crm/status-pill';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import {
  getCrmQuotationRelatedCounts,
  getQuotation,
} from '@/app/actions/crm/quotations.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { CrmQuotationLineItem } from '@/lib/rust-client/crm-quotations';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { LineageKind } from '@/lib/definitions';

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

export default async function QuotationDetailPage({
  params,
  searchParams,
}: PageProps) {
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

  /* ─── Detail surface composed via <EntityDetailShell> ─────── */

  return (
    <EntityDetailShell
      title={`Quotation ${quotation.quotationNo}`}
      eyebrow={`QUOTATION ${quotation.quotationNo}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{ href: '/dashboard/crm/sales/quotations', label: 'All quotations' }}
      actions={
        <QuotationDetailActions
          quotationId={quotationId}
          status={status}
          quotationNo={quotation.quotationNo}
        />
      }
      rightRail={
        <>
          {/* Status flow visualizer */}
          <ZoruCard>
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
          </ZoruCard>

          {/* Lineage rail */}
          <LineageRail
            current={{
              kind: 'quotation',
              id: quotationId,
              no: quotation.quotationNo,
              status,
            }}
            lineage={
              (quotation.lineage ?? []) as Array<{
                kind: LineageKind;
                id: string;
                no?: string;
                status?: string;
              }>
            }
          />

          {/* At a glance + quick edits */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>At a glance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <QuotationQuickEdits
                quotationId={quotationId}
                salesAgentId={salesAgentId}
                status={status}
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(totals.total, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Valid until</span>
                  <span>{fmtDate(quotation.validUntil)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>
                    {fmtDate(quotation.createdAt || quotation.audit?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>
                    {fmtDate(quotation.updatedAt || quotation.audit?.updatedAt)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          {/* Related entities */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-1">
              <Link
                href={`/dashboard/crm/sales/orders?quotationId=${quotationId}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-zoru-ink hover:bg-zoru-surface-2"
              >
                <span className="inline-flex items-center gap-2 text-zoru-ink-muted">
                  <ShoppingCart className="h-4 w-4" /> Sales orders
                </span>
                <ZoruBadge variant="secondary">
                  {relatedCounts.salesOrders}
                </ZoruBadge>
              </Link>
              <Link
                href={`/dashboard/crm/sales/invoices?quotationId=${quotationId}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-zoru-ink hover:bg-zoru-surface-2"
              >
                <span className="inline-flex items-center gap-2 text-zoru-ink-muted">
                  <Receipt className="h-4 w-4" /> Invoices
                </span>
                <ZoruBadge variant="secondary">
                  {relatedCounts.invoices}
                </ZoruBadge>
              </Link>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruButton size="sm" variant="ghost" asChild className="w-full">
            <Link
              href={`/dashboard/crm/sales/quotations/${quotationId}/activity`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </ZoruButton>
        </>
      }
      audit={
        <EntityAuditTimeline entityKind="quotation" entityId={quotationId} />
      }
    >
      <p className="text-[12.5px] text-zoru-ink-muted">
        {fmtMoney(totals.total, currency)} · {status}
      </p>

      {/* Overview */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Overview</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Quotation #">
              {quotation.quotationNo}
            </DetailField>
            <DetailField label="Status">
              <ZoruBadge variant="secondary">{status}</ZoruBadge>
            </DetailField>
            <DetailField label="Date">{fmtDate(quotation.date)}</DetailField>
            <DetailField label="Valid until">
              {fmtDate(quotation.validUntil)}
            </DetailField>
            <DetailField label="Currency">{currency}</DetailField>
            <DetailField label="Place of supply">
              {quotation.placeOfSupply || '—'}
            </DetailField>
            <DetailField label="Subject">
              {quotation.subject || '—'}
            </DetailField>
            <DetailField label="Reference #">
              {quotation.referenceNo || '—'}
            </DetailField>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {/* Customer */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Customer</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
        </ZoruCardContent>
      </ZoruCard>

      {/* Line items */}
      <ZoruCard>
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
                    <th className="p-2 text-left">HSN</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit price</th>
                    <th className="p-2 text-right">Disc</th>
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
                      <td className="p-2 text-left font-mono text-[11.5px] tabular-nums text-zoru-ink-muted">
                        {(li as { hsn?: string }).hsn ?? '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                        {li.qty}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-zoru-ink">
                        {fmtMoney(li.rate, currency)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-zoru-ink-muted">
                        {typeof (li as { discountPct?: number }).discountPct ===
                        'number'
                          ? `${(li as { discountPct: number }).discountPct}%`
                          : '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-zoru-ink-muted">
                        {typeof li.taxRatePct === 'number'
                          ? `${li.taxRatePct}%`
                          : '—'}
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
        </ZoruCardContent>
      </ZoruCard>

      {/* Money summary */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Money summary</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
            {typeof (
              totals as { taxCgst?: number }
            ).taxCgst === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-zoru-ink-muted">CGST</span>
                <span className="font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(
                    (totals as { taxCgst: number }).taxCgst,
                    currency,
                  )}
                </span>
              </div>
            ) : null}
            {typeof (
              totals as { taxSgst?: number }
            ).taxSgst === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-zoru-ink-muted">SGST</span>
                <span className="font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(
                    (totals as { taxSgst: number }).taxSgst,
                    currency,
                  )}
                </span>
              </div>
            ) : null}
            {typeof (
              totals as { taxIgst?: number }
            ).taxIgst === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-zoru-ink-muted">IGST</span>
                <span className="font-mono tabular-nums text-zoru-ink">
                  {fmtMoney(
                    (totals as { taxIgst: number }).taxIgst,
                    currency,
                  )}
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
        </ZoruCardContent>
      </ZoruCard>

      {/* Terms */}
      {quotation.termsAndConditions ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Terms &amp; conditions</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {quotation.termsAndConditions}
            </p>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* Notes */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Notes</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {quotation.customerNotes ? (
            <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
              {quotation.customerNotes}
            </p>
          ) : (
            <p className="text-[13px] text-zoru-ink-muted">
              No notes yet — add them via the Edit form.
            </p>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Attachments — surfaced from customFields stash when present */}
      {Array.isArray((cfValues._attachments as unknown) as string[]) ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Attachments</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-zoru-ink">
              {(cfValues._attachments as string[]).map((u) => (
                <li key={u}>
                  <a
                    className="hover:underline"
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {u.split('/').pop()}
                  </a>
                </li>
              ))}
            </ul>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* Tags */}
      {Array.isArray((cfValues._tags as unknown) as string[]) ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Tags</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="flex flex-wrap gap-2">
              {(cfValues._tags as string[]).map((t) => (
                <ZoruBadge key={t} variant="outline">
                  {t}
                </ZoruBadge>
              ))}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* Custom fields */}
      {customFields.length > 0 ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Custom fields</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {customFields.map((f) => (
                <DetailField
                  key={String(f._id ?? f.name)}
                  label={f.label || f.name}
                >
                  <CustomFieldDisplay
                    field={f}
                    value={
                      cfValues[f.name] as Parameters<
                        typeof CustomFieldDisplay
                      >[0]['value']
                    }
                  />
                </DetailField>
              ))}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* TODO 1D.2: <CrmNotes recordType="quotation"> composer — needs the
          shared composer to accept `quotation` as a recordType. */}
      {/* TODO 1D.2: inline attachment add via <SabFilePicker> — needs an
          `addQuotationAttachment(quotationId, fileId)` action. */}
      {/* TODO 1D.2: inline status change via <EnumFormField enumName="quotationStatus">
          on the status pill — needs a `setQuotationStatus(quotationId, status)`
          quick mutation that revalidates the page. The dropdown already exists
          in <QuotationDetailActions> as a fallback. */}
    </EntityDetailShell>
  );
}
