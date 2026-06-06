import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import { ArrowLeft,
  ClipboardList,
  Receipt,
  ShoppingCart } from 'lucide-react';

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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
import { QuotationRealtimeSubscriber } from '../_components/quotation-realtime-subscriber';
import { QuotationFloatingBar } from '../_components/quotation-floating-bar';
import { AutoPrint } from '../_components/auto-print';

import { CrmLineageChart, LineageNode } from '@/components/crm/crm-lineage-chart';
import { Crm360Timeline } from '@/components/crm/crm-360-timeline';
import { addCrmNote, getCrmEntityTimeline } from '@/app/actions/crm.actions';
import { revalidatePath } from 'next/cache';
import { writeAuditEntry } from '@/lib/audit-log';

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
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
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
          <p className="text-[14px] text-[var(--st-text)]">
            Couldn&apos;t load this quotation — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/sales/quotations">
              <ArrowLeft className="h-4 w-4" /> Back to Quotations
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const quotationId = String(quotation._id);

  // Hydrate timeline items
  const timelineItemsRes = await getCrmEntityTimeline('quotation', quotationId);
  const timelineItems = timelineItemsRes.success ? timelineItemsRes.items : [];

  // Server Actions for the interactive 360 timeline
  async function addCommentAction(body: string): Promise<boolean> {
    'use server';
    const fd = new FormData();
    fd.append('recordId', quotationId);
    fd.append('recordType', 'quotation');
    fd.append('noteContent', body);
    const res = await addCrmNote(null, fd);
    if (!res.error) {
      revalidatePath(`/dashboard/crm/sales/quotations/${quotationId}`);
      return true;
    }
    return false;
  }

  async function sendWhatsAppAction(templateId: string, phone: string): Promise<boolean> {
    'use server';
    const fd = new FormData();
    fd.append('recordId', quotationId);
    fd.append('recordType', 'quotation');
    fd.append('noteContent', `Shoot WhatsApp template notification: "${templateId}" sent to ${phone}`);
    const res = await addCrmNote(null, fd);
    if (!res.error) {
      const session = await getSession();
      if (session?.user?._id) {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          action: 'whatsapp_notification_sent',
          entityKind: 'quotation',
          entityId: quotationId,
          reason: `WhatsApp template "${templateId}" sent to ${phone}`,
        });
      }
      revalidatePath(`/dashboard/crm/sales/quotations/${quotationId}`);
      return true;
    }
    return false;
  }

  const status = (quotation.status ?? 'draft').toLowerCase();
  const cfValues = (quotation.customFields ?? {}) as Record<string, unknown>;
  const items: CrmQuotationLineItem[] = quotation.items ?? [];
  const totals = quotation.totals ?? { subTotal: 0, total: 0 };
  const currency = quotation.currency ?? 'INR';
  const salesAgentId =
    quotation.assignment?.assignedTo ?? quotation.salesAgentId ?? null;

  const lineageList = (quotation.lineage ?? []) as Array<{
    kind: LineageKind;
    id: string;
    no?: string;
    status?: string;
  }>;

  const findLinked = (kind: string) => lineageList.find(x => x.kind === kind);

  const lineageNodes: LineageNode[] = [
    {
      id: findLinked('lead')?.id ?? 'lead-pending',
      label: 'Lead Conversion',
      type: 'Lead',
      status: findLinked('lead') ? 'completed' : 'pending',
      docNumber: findLinked('lead')?.no ?? 'Awaiting Lead',
    },
    {
      id: quotationId,
      label: 'Quotation Stage',
      type: 'Quotation',
      status: 'active',
      docNumber: quotation.quotationNo ?? `QTN-${quotationId.slice(-6).toUpperCase()}`,
      valueString: fmtMoney(totals.total, currency),
      dateString: fmtDate(quotation.date),
    },
    {
      id: findLinked('salesOrder')?.id ?? 'so-pending',
      label: 'Sales Order',
      type: 'SalesOrder',
      status: findLinked('salesOrder') ? 'completed' : 'pending',
      docNumber: findLinked('salesOrder')?.no ?? 'Awaiting Order',
    },
    {
      id: findLinked('deliveryChallan')?.id ?? 'delivery-pending',
      label: 'Delivery Challan',
      type: 'Delivery',
      status: findLinked('deliveryChallan') ? 'completed' : 'pending',
      docNumber: findLinked('deliveryChallan')?.no ?? 'Awaiting Delivery',
    },
    {
      id: findLinked('invoice')?.id ?? 'invoice-pending',
      label: 'Tax Invoice',
      type: 'Invoice',
      status: findLinked('invoice') ? 'completed' : 'pending',
      docNumber: findLinked('invoice')?.no ?? 'Awaiting Invoice',
    },
    {
      id: findLinked('paymentReceipt')?.id ?? 'receipt-pending',
      label: 'Payment Receipt',
      type: 'Receipt',
      status: findLinked('paymentReceipt') ? 'completed' : 'pending',
      docNumber: findLinked('paymentReceipt')?.no ?? 'Awaiting Payment',
    },
  ];

  /* ─── Print mode ────────────────────────────────────────────── */

  if (printMode) {
    return (
      <>
        <QuotationPrintView quotation={quotation} />
        {sp?.autoPrint === '1' && <AutoPrint />}
      </>
    );
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
          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardBody>
              <QuotationQuickEdits
                quotationId={quotationId}
                salesAgentId={salesAgentId}
                status={status}
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(totals.total, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Valid until</span>
                  <span>{fmtDate(quotation.validUntil)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Created</span>
                  <span>
                    {fmtDate(quotation.createdAt || quotation.audit?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Updated</span>
                  <span>
                    {fmtDate(quotation.updatedAt || quotation.audit?.updatedAt)}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Related entities */}
          <Card>
            <CardHeader>
              <CardTitle>Related</CardTitle>
            </CardHeader>
            <CardBody className="space-y-1">
              <Link
                href={`/dashboard/crm/sales/orders?quotationId=${quotationId}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
              >
                <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                  <ShoppingCart className="h-4 w-4" /> Sales orders
                </span>
                <Badge variant="secondary">
                  {relatedCounts.salesOrders}
                </Badge>
              </Link>
              <Link
                href={`/dashboard/crm/sales/invoices?quotationId=${quotationId}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
              >
                <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                  <Receipt className="h-4 w-4" /> Invoices
                </span>
                <Badge variant="secondary">
                  {relatedCounts.invoices}
                </Badge>
              </Link>
            </CardBody>
          </Card>

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link
              href={`/dashboard/crm/sales/quotations/${quotationId}/activity`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={null}
    >
      {/* 1D.5 lineage node track chart */}
      <div className="mb-6">
        <CrmLineageChart nodes={lineageNodes} />
      </div>

      <p className="text-[12.5px] text-[var(--st-text-secondary)] mb-4">
        {fmtMoney(totals.total, currency)} · {status}
      </p>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Quotation #">
              {quotation.quotationNo}
            </DetailField>
            <DetailField label="Status">
              <Badge variant="secondary">{status}</Badge>
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
        </CardBody>
      </Card>

      {/* Customer */}
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardBody>
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
                      className="border-t border-[var(--st-border)]"
                    >
                      <td className="p-2">
                        {li.itemId ? (
                          <EntityPickerChip entity="item" id={li.itemId} />
                        ) : (
                          <span className="text-[var(--st-text)]">
                            {li.description || '—'}
                          </span>
                        )}
                        {li.itemId && li.description ? (
                          <div className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">
                            {li.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 text-left font-mono text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
                        {(li as { hsn?: string }).hsn ?? '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {li.qty}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {fmtMoney(li.rate, currency)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text-secondary)]">
                        {typeof (li as { discountPct?: number }).discountPct ===
                        'number'
                          ? `${(li as { discountPct: number }).discountPct}%`
                          : '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text-secondary)]">
                        {typeof li.taxRatePct === 'number'
                          ? `${li.taxRatePct}%`
                          : '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {fmtMoney(li.total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Money summary */}
      <Card>
        <CardHeader>
          <CardTitle>Money summary</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-2 md:grid-cols-2 text-[13px]">
            <div className="flex justify-between md:col-start-2">
              <span className="text-[var(--st-text-secondary)]">Subtotal</span>
              <span className="font-mono tabular-nums text-[var(--st-text)]">
                {fmtMoney(totals.subTotal, currency)}
              </span>
            </div>
            {typeof totals.discountOverall === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Discount</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  −{fmtMoney(totals.discountOverall, currency)}
                </span>
              </div>
            ) : null}
            {typeof (
              totals as { taxCgst?: number }
            ).taxCgst === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">CGST</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
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
                <span className="text-[var(--st-text-secondary)]">SGST</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
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
                <span className="text-[var(--st-text-secondary)]">IGST</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney(
                    (totals as { taxIgst: number }).taxIgst,
                    currency,
                  )}
                </span>
              </div>
            ) : null}
            {typeof totals.shippingCharge === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Shipping</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney(totals.shippingCharge, currency)}
                </span>
              </div>
            ) : null}
            {typeof totals.adjustment === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Adjustment</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney(totals.adjustment, currency)}
                </span>
              </div>
            ) : null}
            {typeof totals.roundOff === 'number' ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Round-off</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney(totals.roundOff, currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-[var(--st-border)] pt-2 md:col-start-2">
              <span className="font-medium text-[var(--st-text)]">Total</span>
              <span className="font-medium font-mono tabular-nums text-[var(--st-text)]">
                {fmtMoney(totals.total, currency)}
              </span>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* Terms */}
      {quotation.termsAndConditions ? (
        <Card>
          <CardHeader>
            <CardTitle>Terms &amp; conditions</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {quotation.termsAndConditions}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardBody>
          {quotation.customerNotes ? (
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {quotation.customerNotes}
            </p>
          ) : (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No notes yet — add them via the Edit form.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Attachments — surfaced from customFields stash when present */}
      {Array.isArray((cfValues._attachments as unknown) as string[]) ? (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-[var(--st-text)]">
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
          </CardBody>
        </Card>
      ) : null}

      {/* Tags */}
      {Array.isArray((cfValues._tags as unknown) as string[]) ? (
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {(cfValues._tags as string[]).map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Custom fields */}
      {customFields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Custom fields</CardTitle>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>
      ) : null}

      {/* Interactive 360 Timeline */}
      <div className="mt-8">
        <Crm360Timeline
          items={timelineItems}
          onAddComment={addCommentAction}
          onSendWhatsApp={sendWhatsAppAction}
        />
      </div>

      <QuotationRealtimeSubscriber quotationId={quotationId} />
      <QuotationFloatingBar quotationId={quotationId} />
    </EntityDetailShell>
  );
}
