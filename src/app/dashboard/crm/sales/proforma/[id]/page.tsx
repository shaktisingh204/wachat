import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardList, Pencil, FileText } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { statusToTone } from '@/components/crm/status-pill';
import { getProformaInvoiceById } from '@/app/actions/crm-proforma-invoices.actions';
import { CrmLineageChart, LineageNode } from '@/components/crm/crm-lineage-chart';
import { Crm360Timeline } from '@/components/crm/crm-360-timeline';
import { addCrmNote, getCrmEntityTimeline } from '@/app/actions/crm.actions';
import { revalidatePath } from 'next/cache';
import { writeAuditEntry } from '@/lib/audit-log';
import { getSession } from '@/app/actions/user.actions';
import type { LineageKind } from '@/lib/definitions';

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

const STATUS_FLOW = ['Draft', 'Sent', 'Accepted', 'Converted'] as const;
const TERMINAL_STATUSES = new Set(['Declined', 'Expired', 'Rejected']);

interface StatusStepProps {
  status: string;
  current: string;
}

function StatusStep({ status, current }: StatusStepProps) {
  const isCurrent = status.toLowerCase() === current.toLowerCase();
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

export default async function ProformaDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const proforma = await getProformaInvoiceById(id);

  if (!proforma) {
    notFound();
  }

  const proformaId = String(proforma._id);

  // Hydrate timeline items
  const timelineItemsRes = await getCrmEntityTimeline('proforma', proformaId);
  const timelineItems = timelineItemsRes.success ? timelineItemsRes.items : [];

  // Server Actions for the interactive 360 timeline
  async function addCommentAction(body: string): Promise<boolean> {
    'use server';
    const fd = new FormData();
    fd.append('recordId', proformaId);
    fd.append('recordType', 'proforma');
    fd.append('noteContent', body);
    const res = await addCrmNote(null, fd);
    if (!res.error) {
      revalidatePath(`/dashboard/crm/sales/proforma/${proformaId}`);
      return true;
    }
    return false;
  }

  async function sendWhatsAppAction(templateId: string, phone: string): Promise<boolean> {
    'use server';
    const fd = new FormData();
    fd.append('recordId', proformaId);
    fd.append('recordType', 'proforma');
    fd.append('noteContent', `Shoot WhatsApp template notification: "${templateId}" sent to ${phone}`);
    const res = await addCrmNote(null, fd);
    if (!res.error) {
      const session = await getSession();
      if (session?.user?._id) {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          action: 'whatsapp_notification_sent',
          entityKind: 'proforma',
          entityId: proformaId,
          reason: `WhatsApp template "${templateId}" sent to ${phone}`,
        });
      }
      revalidatePath(`/dashboard/crm/sales/proforma/${proformaId}`);
      return true;
    }
    return false;
  }

  const status = proforma.status || 'Draft';
  const currency = proforma.currency || 'INR';
  const lineItems = proforma.lineItems || [];
  
  const lineageList = (proforma.lineage ?? []) as Array<{
    kind: LineageKind;
    id: string;
    no?: string;
    status?: string;
  }>;

  const findLinked = (kind: string) => lineageList.find(x => x.kind === kind);

  // Setup visual lineage nodes
  const lineageNodes: LineageNode[] = [
    {
      id: findLinked('lead')?.id ?? 'lead-pending',
      label: 'Lead Conversion',
      type: 'Lead',
      status: findLinked('lead') ? 'completed' : 'pending',
      docNumber: findLinked('lead')?.no ?? 'Awaiting Lead',
    },
    {
      id: findLinked('quotation')?.id ?? 'quotation-pending',
      label: 'Quotation Stage',
      type: 'Quotation',
      status: findLinked('quotation') ? 'completed' : 'pending',
      docNumber: findLinked('quotation')?.no ?? 'Awaiting Quotation',
    },
    {
      id: proformaId,
      label: 'Proforma Invoice',
      type: 'Invoice',
      status: 'active',
      docNumber: proforma.proformaNumber ?? `PRO-${proformaId.slice(-6).toUpperCase()}`,
      valueString: fmtMoney(proforma.total, currency),
      dateString: fmtDate(proforma.proformaDate),
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

  return (
    <EntityDetailShell
      title={`Proforma ${proforma.proformaNumber}`}
      eyebrow={`PROFORMA INVOICE ${proforma.proformaNumber}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{ href: '/dashboard/crm/sales/proforma', label: 'All proformas' }}
      actions={
        <Button asChild>
          <Link href={`/dashboard/crm/sales/proforma/${proformaId}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit proforma
          </Link>
        </Button>
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
              kind: 'proforma',
              id: proformaId,
              no: proforma.proformaNumber,
              status,
            }}
            lineage={
              (proforma.lineage ?? []) as Array<{
                kind: LineageKind;
                id: string;
                no?: string;
                status?: string;
              }>
            }
          />

          {/* At a glance */}
          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(proforma.total, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Valid until</span>
                  <span>{fmtDate(proforma.validTillDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Created</span>
                  <span>{fmtDate(proforma.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--st-text-secondary)]">Updated</span>
                  <span>{fmtDate(proforma.updatedAt)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link href={`/dashboard/crm/sales/proforma/${proformaId}/activity`}>
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={null}
    >
      {/* Visual Conversion Nodes */}
      <div className="mb-6">
        <CrmLineageChart nodes={lineageNodes} />
      </div>

      <p className="text-[12.5px] text-[var(--st-text-secondary)] mb-4">
        {fmtMoney(proforma.total, currency)} · {status}
      </p>

      {/* Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Proforma #">
              {proforma.proformaNumber}
            </DetailField>
            <DetailField label="Status">
              <Badge variant="secondary">{status}</Badge>
            </DetailField>
            <DetailField label="Date">{fmtDate(proforma.proformaDate)}</DetailField>
            <DetailField label="Valid until">
              {fmtDate(proforma.validTillDate)}
            </DetailField>
            <DetailField label="Currency">{currency}</DetailField>
            <DetailField label="Place of supply">
              {(proforma as any).placeOfSupply || '—'}
            </DetailField>
            <DetailField label="Reference / Subject">
              {(proforma as any).subject || '—'}
            </DetailField>
          </div>
        </CardBody>
      </Card>

      {/* Customer details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Customer &amp; Client Info</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Customer Account">
              {proforma.accountId ? (
                <EntityPickerChip entity="client" id={String(proforma.accountId)} />
              ) : (
                '—'
              )}
            </DetailField>
          </div>
        </CardBody>
      </Card>

      {/* Line items table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardBody>
          {lineItems.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">No line items.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-[var(--st-border)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                  <tr>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">HSN/SAC</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit price</th>
                    <th className="p-2 text-right">Discount</th>
                    <th className="p-2 text-right">Tax Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-[var(--st-border)] last:border-b last:border-[var(--st-border)]"
                    >
                      <td className="p-2 font-medium text-[var(--st-text)]">
                        {li.description || '—'}
                      </td>
                      <td className="p-2 font-mono text-[11px] text-[var(--st-text-secondary)]">
                        {(li as any).hsnSac || '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {li.quantity}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {fmtMoney(li.rate, currency)}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text-secondary)]">
                        {typeof (li as any).discountPct === 'number'
                          ? `${(li as any).discountPct}%`
                          : '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text-secondary)]">
                        {typeof li.taxPct === 'number'
                          ? `${li.taxPct}%`
                          : '—'}
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums text-[var(--st-text)]">
                        {fmtMoney((li as any).amount || (li.quantity * li.rate), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Money summary / Statutory computation break-down */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statutory Financial Summary</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-2 md:grid-cols-2 text-[13px]">
            <div className="flex justify-between md:col-start-2">
              <span className="text-[var(--st-text-secondary)]">Subtotal</span>
              <span className="font-mono tabular-nums text-[var(--st-text)]">
                {fmtMoney(proforma.subtotal, currency)}
              </span>
            </div>
            {typeof (proforma as any).discountOverall === 'number' && (proforma as any).discountOverall > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Discount</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  −{fmtMoney((proforma as any).discountOverall, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).taxCgst === 'number' && (proforma as any).taxCgst > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">CGST</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney((proforma as any).taxCgst, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).taxSgst === 'number' && (proforma as any).taxSgst > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">SGST</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney((proforma as any).taxSgst, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).taxIgst === 'number' && (proforma as any).taxIgst > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">IGST</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney((proforma as any).taxIgst, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).shippingCharge === 'number' && (proforma as any).shippingCharge > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Shipping</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney((proforma as any).shippingCharge, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).adjustment === 'number' && (proforma as any).adjustment !== 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Adjustment</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney((proforma as any).adjustment, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).roundOff === 'number' && (proforma as any).roundOff !== 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">Round-off</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  {fmtMoney((proforma as any).roundOff, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).tdsPct === 'number' && (proforma as any).tdsPct > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">TDS withheld ({(proforma as any).tdsPct}%)</span>
                <span className="font-mono tabular-nums text-[var(--st-danger)]">
                  −{fmtMoney(((proforma as any).subtotal * (proforma as any).tdsPct) / 100, currency)}
                </span>
              </div>
            ) : null}
            {typeof (proforma as any).tcsPct === 'number' && (proforma as any).tcsPct > 0 ? (
              <div className="flex justify-between md:col-start-2">
                <span className="text-[var(--st-text-secondary)]">TCS collected ({(proforma as any).tcsPct}%)</span>
                <span className="font-mono tabular-nums text-[var(--st-text)]">
                  +{fmtMoney(((proforma as any).subtotal * (proforma as any).tcsPct) / 100, currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-[var(--st-border)] pt-2 md:col-start-2">
              <span className="font-medium text-[var(--st-text)]">Total</span>
              <span className="font-medium font-mono tabular-nums text-[var(--st-text)]">
                {fmtMoney(proforma.total, currency)}
              </span>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* Terms & notes */}
      {proforma.termsAndConditions && proforma.termsAndConditions.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Terms &amp; conditions</CardTitle>
          </CardHeader>
          <CardBody>
            <ol className="list-decimal pl-5 space-y-1 text-[13px] text-[var(--st-text)]">
              {proforma.termsAndConditions.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardBody>
          {proforma.notes ? (
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {proforma.notes}
            </p>
          ) : (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              No notes yet — add them via the Edit form.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Interactive 360 Timeline */}
      <div className="mt-8">
        <Crm360Timeline
          items={timelineItems}
          onAddComment={addCommentAction}
          onSendWhatsApp={sendWhatsAppAction}
        />
      </div>
    </EntityDetailShell>
  );
}
