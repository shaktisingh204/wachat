import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import {
  ArrowLeft,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileMinus,
  FileText,
  ShoppingCart,
  Truck,
  } from 'lucide-react';

/**
 * Invoice detail — `/dashboard/crm/sales/invoices/[id]` (§1D.2 rebuild).
 *
 * Phase 1.1B Wave 2 partial rebuild — wraps the existing detail body in
 * the shared <EntityDetailShell> per the §1D.5 bar. Header status pill +
 * eyebrow + back link + 9-button action group · main body (overview /
 * customer / line items / money summary / payment history / e-invoice /
 * notes / tags / custom fields) · right rail (LineageRail + customer
 * chip + at-a-glance + related-counts + activity link) · audit footer.
 *
 * Mirrors the ACCOUNTS template at
 * `src/app/dashboard/crm/accounts/[accountId]/page.tsx`.
 */
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PinButton } from '@/components/crm/pin-button';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { statusToTone } from '@/components/crm/status-pill';
import {
  getCrmInvoiceRelatedCounts,
  getInvoice,
} from '@/app/actions/crm/invoices.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { LineageKind } from '@/lib/definitions';

import { InvoiceDetailActions } from '../_components/invoice-detail-actions';
import { InvoiceDetailBody } from '../_components/invoice-detail-body';
import { InvoicePrintView } from '../_components/invoice-print-view';
import { InvoiceQuickEdits } from '../_components/invoice-quick-edits';
import { InvoiceRelatedRail } from '../_components/invoice-related-rail';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

function fmtMoney(value: number | undefined, currency: string): string {
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

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function detailToneFor(status: string | undefined):
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'neutral' {
  return statusToTone(status);
}

async function hydrateCustomer(
  clientId: string | undefined,
  userId: ObjectId,
): Promise<{ name: string | null; email: string | null; phone: string | null }> {
  if (!clientId || !ObjectId.isValid(clientId)) {
    return { name: null, email: null, phone: null };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection('crm_accounts')
      .findOne(
        { _id: new ObjectId(clientId), userId },
        { projection: { name: 1, email: 1, phone: 1 } },
      );
    return {
      name: (doc as { name?: string } | null)?.name ?? null,
      email: (doc as { email?: string } | null)?.email ?? null,
      phone: (doc as { phone?: string } | null)?.phone ?? null,
    };
  } catch {
    return { name: null, email: null, phone: null };
  }
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const printMode = sp?.print === '1';

  const session = await getSession();

  const [{ invoice, error }, customFields] = await Promise.all([
    getInvoice(id),
    getCustomFieldsFor('invoice') as Promise<WsCustomField[]>,
  ]);

  if (!invoice) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this invoice — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/sales/invoices">
              <ArrowLeft className="h-4 w-4" /> Back to Invoices
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const invoiceId = String(invoice._id);
  const currency = invoice.currency || 'INR';
  const status = invoice.status ?? 'draft';
  const totals = invoice.totals ?? { subTotal: 0, total: 0 };
  const cfValues = (invoice.customFields ?? {}) as Record<string, unknown>;

  const userObjectId = session?.user?._id
    ? new ObjectId(String(session.user._id))
    : null;
  const [customer, related] = await Promise.all([
    userObjectId
      ? hydrateCustomer(invoice.clientId, userObjectId)
      : Promise.resolve({ name: null, email: null, phone: null }),
    getCrmInvoiceRelatedCounts(invoiceId),
  ]);

  if (printMode) {
    return (
      <InvoicePrintView
        invoice={invoice}
        customerLabel={customer.name ?? invoice.clientId}
      />
    );
  }

  /* Related rail items (counts come from getCrmInvoiceRelatedCounts) */
  const relatedRailItems: {
    label: string;
    count: number;
    icon: React.ReactNode;
    href: string;
  }[] = [
    {
      label: 'Receipts',
      count: related.receipts,
      icon: <CreditCard className="h-4 w-4" />,
      href: `/dashboard/crm/sales/receipts?invoiceId=${invoiceId}`,
    },
    {
      label: 'Credit notes',
      count: related.creditNotes,
      icon: <FileMinus className="h-4 w-4" />,
      href: `/dashboard/crm/sales/credit-notes?invoiceId=${invoiceId}`,
    },
    {
      label: 'Quotations',
      count: related.quotations,
      icon: <FileText className="h-4 w-4" />,
      href: `/dashboard/crm/sales/quotations?invoiceId=${invoiceId}`,
    },
    {
      label: 'Sales orders',
      count: related.salesOrders,
      icon: <ShoppingCart className="h-4 w-4" />,
      href: `/dashboard/crm/sales/orders?invoiceId=${invoiceId}`,
    },
    {
      label: 'Deliveries',
      count: related.deliveries,
      icon: <Truck className="h-4 w-4" />,
      href: `/dashboard/crm/sales/delivery-challans?invoiceId=${invoiceId}`,
    },
  ];

  const title = invoice.invoiceNo || `Invoice ${invoiceId.slice(-6)}`;
  const subtitleParts = [
    `Issued ${fmtDate(invoice.date)}`,
    `Due ${fmtDate(invoice.dueDate)}`,
    fmtMoney(totals.total, currency),
  ];

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`INVOICE ${invoice.invoiceNo ?? invoiceId.slice(-6)}`}
      status={{ label: String(status), tone: detailToneFor(String(status)) }}
      back={{ href: '/dashboard/crm/sales/invoices', label: 'All invoices' }}
      actions={
        <div className="flex items-center gap-2">
          <PinButton
            entityType="invoice"
            entityId={invoiceId}
            title={title}
          />
          <InvoiceDetailActions
            invoiceId={invoiceId}
            invoiceNo={invoice.invoiceNo ?? ''}
            status={String(status)}
            contactEmail={customer.email}
            contactPhone={customer.phone}
          />
        </div>
      }
      rightRail={
        <>
          {/* Lineage rail */}
          <LineageRail
            current={{
              kind: 'invoice',
              id: invoiceId,
              no: invoice.invoiceNo,
              status: invoice.status,
            }}
            lineage={
              (invoice.lineage ?? []) as Array<{
                kind: LineageKind;
                id: string;
                no?: string;
                status?: string;
              }>
            }
          />

          {/* Customer chip + outstanding */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Customer</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-[12.5px]">
              {invoice.clientId ? (
                <EntityPickerChip entity="client" id={invoice.clientId} />
              ) : (
                <span className="text-zoru-ink-muted">
                  No customer linked
                </span>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-zoru-line pt-2">
                <span className="text-zoru-ink-muted">Outstanding</span>
                <span
                  className={`font-mono tabular-nums ${
                    (invoice.balance ?? totals.total) > 0
                      ? 'text-zoru-danger-ink'
                      : 'text-zoru-ink'
                  }`}
                >
                  {fmtMoney(invoice.balance ?? totals.total, currency)}
                </span>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          {/* At a glance + quick edits */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>At a glance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <InvoiceQuickEdits
                invoiceId={invoiceId}
                status={String(status)}
                customerId={invoice.clientId}
                salesAgentId={
                  invoice.assignment?.assignedTo
                    ? String(invoice.assignment.assignedTo)
                    : null
                }
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(totals.subTotal, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(totals.total, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Paid</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(invoice.amountPaid ?? 0, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>
                    {fmtDate(invoice.createdAt ?? invoice.audit?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>
                    {fmtDate(invoice.updatedAt ?? invoice.audit?.updatedAt)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>

          {/* Related entities (live counts from getCrmInvoiceRelatedCounts) */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Related</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-1">
              {relatedRailItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-zoru-ink hover:bg-zoru-surface-2"
                >
                  <span className="inline-flex items-center gap-2 text-zoru-ink-muted">
                    {item.icon}
                    {item.label}
                  </span>
                  <ZoruBadge variant="secondary">{item.count}</ZoruBadge>
                </Link>
              ))}
            </ZoruCardContent>
          </ZoruCard>

          {/* Live-poll wrapper kept around for backwards-compatible refresh
              of the related counts when a downstream doc lands. */}
          <InvoiceRelatedRail invoiceId={invoiceId} initial={related} />

          <ZoruButton size="sm" variant="ghost" asChild className="w-full">
            <Link href={`/dashboard/crm/sales/invoices/${invoiceId}/activity`}>
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </ZoruButton>
        </>
      }
      audit={<EntityAuditTimeline entityKind="invoice" entityId={invoiceId} />}
    >
      {/* Subtitle banner (the EntityDetailShell uses a narrow header so we
          surface dates + total just below it as a thin breadcrumb row). */}
      <p className="text-[12.5px] text-zoru-ink-muted">
        {subtitleParts.join(' · ')}
      </p>

      {/* Body — overview, customer, line items, money summary. */}
      <InvoiceDetailBody
        invoice={invoice}
        customer={{ email: customer.email, phone: customer.phone }}
      />

      {/* Payment history */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {related.receipts === 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No payment receipts applied yet.{' '}
              <Link
                href={`/dashboard/crm/sales/receipts/new?fromKind=invoice&fromId=${invoiceId}`}
                className="text-zoru-primary hover:underline"
              >
                Record a payment
              </Link>
            </p>
          ) : (
            <Link
              href={`/dashboard/crm/sales/receipts?invoiceId=${invoiceId}`}
              className="text-[13px] text-zoru-primary hover:underline"
            >
              View {related.receipts} receipt
              {related.receipts === 1 ? '' : 's'} applied to this invoice →
            </Link>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* E-invoice */}
      {invoice.eInvoice ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>E-invoice</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="grid gap-4 md:grid-cols-2 text-[13px]">
              <p>
                <span className="text-zoru-ink-muted">IRN:</span>{' '}
                {invoice.eInvoice.irn || '—'}
              </p>
              <p>
                <span className="text-zoru-ink-muted">Ack no:</span>{' '}
                {invoice.eInvoice.ackNo || '—'}
              </p>
              <p>
                <span className="text-zoru-ink-muted">Ack date:</span>{' '}
                {fmtDate(invoice.eInvoice.ackDate)}
              </p>
              <p className="md:col-span-2">
                <span className="text-zoru-ink-muted">QR string:</span>{' '}
                <code className="break-all text-[11px]">
                  {invoice.eInvoice.qrString}
                </code>
              </p>
            </div>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* Notes */}
      {invoice.customerNotes || invoice.termsAndConditions ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="grid gap-4 md:grid-cols-2 text-[13px]">
              {invoice.customerNotes ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Customer notes
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">
                    {invoice.customerNotes}
                  </p>
                </div>
              ) : null}
              {invoice.termsAndConditions ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Terms &amp; conditions
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">
                    {invoice.termsAndConditions}
                  </p>
                </div>
              ) : null}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* Tags */}
      {Array.isArray(invoice.tags) && invoice.tags.length > 0 ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Tags</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="flex flex-wrap gap-2">
              {invoice.tags.map((t) => (
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
              {customFields.map((field) => (
                <div key={String(field._id ?? field.name)}>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                    {field.label || field.name}
                  </div>
                  <div className="mt-1 text-[13px] text-zoru-ink">
                    <CustomFieldDisplay
                      field={field}
                      value={
                        cfValues[field.name] as Parameters<
                          typeof CustomFieldDisplay
                        >[0]['value']
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      ) : null}

      {/* TODO 1D.2: <CrmNotes recordType="invoice"> composer — needs the
          composer to accept `invoice` as a recordType. Today the composer
          only supports the legacy CRM entities (account / contact / deal /
          lead). Land in a follow-up. */}
      {/* TODO 1D.2: inline attachment add via <SabFilePicker> — needs an
          `addInvoiceAttachment(invoiceId, fileId)` action; not yet on the
          Rust DTO. */}
      {/* TODO 1D.2: inline tag add — needs `setInvoiceTags(invoiceId, tags[])`
          action. */}

      <span aria-hidden className="hidden">
        <CheckSquare />
      </span>
    </EntityDetailShell>
  );
}
