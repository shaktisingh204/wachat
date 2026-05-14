/**
 * Invoice detail — `/dashboard/crm/sales/invoices/[id]`.
 *
 * Server component per CRM_REBUILD_PLAN §1D.2. Composes:
 *   - Header: status pill (click → status change) + 10+ action buttons.
 *   - Body cards via `<InvoiceDetailBody>`: Overview, Customer, Line
 *     items, Money summary. Plus inline cards for payment history,
 *     e-invoice, notes, tags, custom fields.
 *   - Right rail: LineageRail · Customer chip + outstanding balance ·
 *     quick-edit chips · related entities.
 *   - Audit footer via `<EntityAuditTimeline>`.
 *   - `?print=1` renders the standalone print layout.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, ClipboardList } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
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

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/sales/invoices"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Invoices
        </Link>
        <CrmPageHeader
          title={invoice.invoiceNo || 'Invoice'}
          subtitle={`Issued ${fmtDate(invoice.date)} · Due ${fmtDate(invoice.dueDate)} · ${fmtMoney(totals.total, currency)}`}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Sales', href: '/dashboard/crm/sales' },
            { label: 'Invoices', href: '/dashboard/crm/sales/invoices' },
            { label: invoice.invoiceNo || 'Invoice' },
          ]}
        />
        <InvoiceDetailActions
          invoiceId={invoiceId}
          invoiceNo={invoice.invoiceNo ?? ''}
          status={status}
          contactEmail={customer.email}
          contactPhone={customer.phone}
        />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <main className="min-w-0 flex-1 space-y-6">
          <InvoiceDetailBody
            invoice={invoice}
            customer={{ email: customer.email, phone: customer.phone }}
          />

          {/* Payment history */}
          <ZoruCard className="p-6">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Payment history
            </h2>
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
          </ZoruCard>

          {/* E-invoice */}
          {invoice.eInvoice ? (
            <ZoruCard className="p-6">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                E-invoice
              </h2>
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
            </ZoruCard>
          ) : null}

          {/* Notes */}
          {invoice.customerNotes || invoice.termsAndConditions ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Notes
              </h2>
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
            </ZoruCard>
          ) : null}

          {/* Tags */}
          {Array.isArray(invoice.tags) && invoice.tags.length > 0 ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {invoice.tags.map((t) => (
                  <ZoruBadge key={t} variant="outline">
                    {t}
                  </ZoruBadge>
                ))}
              </div>
            </ZoruCard>
          ) : null}

          {/* Custom fields */}
          {customFields.length > 0 ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Custom fields
              </h2>
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
            </ZoruCard>
          ) : null}
        </main>

        <aside className="w-full md:w-80 md:shrink-0">
          <div className="space-y-4 md:sticky md:top-4">
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

            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Customer
              </h3>
              <div className="space-y-2 text-[12.5px]">
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
              </div>
            </ZoruCard>

            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                At a glance
              </h3>
              <InvoiceQuickEdits
                invoiceId={invoiceId}
                status={status}
                customerId={invoice.clientId}
                salesAgentId={
                  invoice.assignment?.assignedTo
                    ? String(invoice.assignment.assignedTo)
                    : null
                }
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
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
            </ZoruCard>

            <InvoiceRelatedRail invoiceId={invoiceId} initial={related} />

            <ZoruButton size="sm" variant="ghost" asChild className="w-full">
              <Link href={`/dashboard/crm/sales/invoices/${invoiceId}/activity`}>
                <ClipboardList className="h-3.5 w-3.5" />
                View full activity log
              </Link>
            </ZoruButton>
          </div>
        </aside>
      </div>

      <EntityAuditTimeline entityKind="invoice" entityId={invoiceId} />
    </div>
  );
}
