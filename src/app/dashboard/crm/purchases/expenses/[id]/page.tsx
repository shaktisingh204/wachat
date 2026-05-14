/**
 * Bill detail — `/dashboard/crm/purchases/expenses/[id]`.
 *
 * Server component per CRM_REBUILD_PLAN §1D. Composes:
 *   - Header: status pill (click → status change) + 10 action buttons.
 *   - Body cards via `<BillDetailBody>`: Overview, Vendor, Line items /
 *     Expense lines, Money summary (CGST/SGST/IGST/cess/TDS), Notes,
 *     Tags, custom fields.
 *   - Right rail: LineageRail · Vendor chip + outstanding · quick-edit
 *     chips · related entities (Payouts, Debit notes, PO, GRN).
 *   - Audit footer via `<EntityAuditTimeline>`.
 *   - `?print=1` renders the standalone print layout.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, ClipboardList } from 'lucide-react';

import { ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import {
  getBill,
  getCrmBillRelatedCounts,
} from '@/app/actions/crm/bills.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { LineageKind } from '@/lib/definitions';

import { BillDetailActions } from '../_components/bill-detail-actions';
import { BillDetailBody } from '../_components/bill-detail-body';
import { BillPrintView } from '../_components/bill-print-view';
import { BillQuickEdits } from '../_components/bill-quick-edits';
import { BillRelatedRail } from '../_components/bill-related-rail';

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

async function hydrateVendor(
  vendorId: string | undefined,
  userId: ObjectId,
): Promise<{ name: string | null; email: string | null; phone: string | null }> {
  if (!vendorId || !ObjectId.isValid(vendorId)) {
    return { name: null, email: null, phone: null };
  }
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection('crm_vendors')
      .findOne(
        { _id: new ObjectId(vendorId), userId },
        {
          projection: {
            name: 1,
            companyName: 1,
            email: 1,
            phone: 1,
            primaryEmail: 1,
          },
        },
      );
    const d = doc as {
      name?: string;
      companyName?: string;
      email?: string;
      primaryEmail?: string;
      phone?: string;
    } | null;
    return {
      name: d?.name ?? d?.companyName ?? null,
      email: d?.email ?? d?.primaryEmail ?? null,
      phone: d?.phone ?? null,
    };
  } catch {
    return { name: null, email: null, phone: null };
  }
}

export default async function BillDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const printMode = sp?.print === '1';

  const session = await getSession();

  const [{ bill, error }, customFields] = await Promise.all([
    getBill(id),
    getCustomFieldsFor('expense') as Promise<WsCustomField[]>,
  ]);

  if (!bill) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this bill — {error}
          </p>
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/expenses">
              <ArrowLeft className="h-4 w-4" /> Back to Bills
            </Link>
          </ZoruButton>
        </div>
      );
    }
    notFound();
  }

  const billId = String(bill._id);
  const currency = bill.currency || 'INR';
  const status = bill.status ?? 'draft';
  const totals = bill.totals ?? { subTotal: 0, total: 0 };
  const cfValues = (bill.customFields ?? {}) as Record<string, unknown>;

  const userObjectId = session?.user?._id
    ? new ObjectId(String(session.user._id))
    : null;
  const [vendor, related] = await Promise.all([
    userObjectId
      ? hydrateVendor(bill.vendorId, userObjectId)
      : Promise.resolve({ name: null, email: null, phone: null }),
    getCrmBillRelatedCounts(billId),
  ]);

  if (printMode) {
    return (
      <BillPrintView
        bill={bill}
        vendorLabel={vendor.name ?? bill.vendorId}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/purchases/expenses"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Bills
        </Link>
        <CrmPageHeader
          title={bill.billNo || 'Bill'}
          subtitle={`Issued ${fmtDate(bill.billDate)} · Due ${fmtDate(bill.dueDate)} · ${fmtMoney(totals.total, currency)}`}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Purchases', href: '/dashboard/crm/purchases' },
            { label: 'Bills', href: '/dashboard/crm/purchases/expenses' },
            { label: bill.billNo || 'Bill' },
          ]}
        />
        <BillDetailActions
          billId={billId}
          billNo={bill.billNo ?? ''}
          status={status}
          vendorEmail={vendor.email}
        />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <main className="min-w-0 flex-1 space-y-6">
          <BillDetailBody
            bill={bill}
            vendorContact={{ email: vendor.email, phone: vendor.phone }}
          />

          {/* Payment history (payouts applied) */}
          <ZoruCard className="p-6">
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Payment history
            </h2>
            {related.payouts === 0 ? (
              <p className="text-[13px] text-zoru-ink-muted">
                No payouts applied yet.{' '}
                <Link
                  href={`/dashboard/crm/purchases/payouts/new?fromKind=bill&fromId=${billId}`}
                  className="text-zoru-primary hover:underline"
                >
                  Record a payout
                </Link>
              </p>
            ) : (
              <Link
                href={`/dashboard/crm/purchases/payouts?billId=${billId}`}
                className="text-[13px] text-zoru-primary hover:underline"
              >
                View {related.payouts} payout
                {related.payouts === 1 ? '' : 's'} applied to this bill →
              </Link>
            )}
          </ZoruCard>

          {/* Linked PO / GRN cards */}
          {bill.linkedPoId || (bill.linkedGrnIds && bill.linkedGrnIds.length) ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Linked documents
              </h2>
              <div className="grid gap-3 md:grid-cols-2 text-[13px]">
                {bill.linkedPoId ? (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                      Purchase order
                    </div>
                    <Link
                      href={`/dashboard/crm/purchases/orders/${bill.linkedPoId}`}
                      className="mt-1 inline-block text-zoru-primary hover:underline"
                    >
                      {bill.linkedPoId}
                    </Link>
                  </div>
                ) : null}
                {bill.linkedGrnIds && bill.linkedGrnIds.length ? (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                      GRNs
                    </div>
                    <ul className="mt-1 space-y-1">
                      {bill.linkedGrnIds.map((gid) => (
                        <li key={gid}>
                          <Link
                            href={`/dashboard/crm/inventory/grn/${gid}`}
                            className="text-zoru-primary hover:underline"
                          >
                            {gid}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
                kind: 'bill',
                id: billId,
                no: bill.billNo,
                status: bill.status,
              }}
              lineage={
                (bill.lineage ?? []) as Array<{
                  kind: LineageKind;
                  id: string;
                  no?: string;
                  status?: string;
                }>
              }
            />

            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Vendor
              </h3>
              <div className="space-y-2 text-[12.5px]">
                {bill.vendorId ? (
                  <EntityPickerChip entity="vendor" id={bill.vendorId} />
                ) : (
                  <span className="text-zoru-ink-muted">No vendor linked</span>
                )}
                <div className="flex items-center justify-between gap-2 border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Outstanding</span>
                  <span
                    className={`font-mono tabular-nums ${
                      (bill.balance ?? totals.total) > 0
                        ? 'text-zoru-danger-ink'
                        : 'text-zoru-ink'
                    }`}
                  >
                    {fmtMoney(bill.balance ?? totals.total, currency)}
                  </span>
                </div>
              </div>
            </ZoruCard>

            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                At a glance
              </h3>
              <BillQuickEdits
                billId={billId}
                status={status}
                vendorId={bill.vendorId}
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Created</span>
                  <span>
                    {fmtDate(bill.createdAt ?? bill.audit?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>
                    {fmtDate(bill.updatedAt ?? bill.audit?.updatedAt)}
                  </span>
                </div>
              </div>
            </ZoruCard>

            <BillRelatedRail billId={billId} initial={related} />

            <ZoruButton size="sm" variant="ghost" asChild className="w-full">
              <Link
                href={`/dashboard/crm/purchases/expenses/${billId}/activity`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                View full activity log
              </Link>
            </ZoruButton>
          </div>
        </aside>
      </div>

      <EntityAuditTimeline entityKind="bill" entityId={billId} />
    </div>
  );
}
