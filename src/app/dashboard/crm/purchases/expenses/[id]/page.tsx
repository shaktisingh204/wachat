/**
 * Bill (vendor invoice) detail — `/dashboard/crm/purchases/expenses/[id]`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2).
 *
 * Server component. Lifted onto the canonical `<EntityDetailShell>` so
 * the header / body / right-rail / audit-footer composition matches the
 * Invoices template at `/dashboard/crm/sales/invoices/[id]`. The body
 * composition is unchanged (`<BillDetailBody>` already met the §1D.2
 * bar) — this rebuild only swaps the page chrome.
 *
 * Header: back link + eyebrow + status pill + 8+ action group
 * (Record payment / Mark paid / Approve / Email / Print / Duplicate /
 * Archive / Delete / Status change, see <BillDetailActions>).
 * Body: overview, vendor, line items / expense lines, money summary,
 * payment history, linked PO / GRN cards, custom fields, notes, tags.
 * Right rail: LineageRail (PO→GRN→bill→payout) · vendor chip with
 * outstanding · quick-edit chips · related-counts · activity link.
 * Audit footer: <EntityAuditTimeline entityKind="bill">.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft, ClipboardList } from 'lucide-react';

import {
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
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { statusToTone } from '@/components/crm/status-pill';
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

  // Parallel fan-out — bill fetch + custom-field schema are independent.
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
      <BillPrintView bill={bill} vendorLabel={vendor.name ?? bill.vendorId} />
    );
  }

  const title = bill.billNo || `Bill ${billId.slice(-6)}`;
  const subtitleParts = [
    `Issued ${fmtDate(bill.billDate)}`,
    `Due ${fmtDate(bill.dueDate)}`,
    fmtMoney(totals.total, currency),
  ];

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`BILL ${bill.billNo ?? billId.slice(-6)}`}
      status={{ label: String(status), tone: statusToTone(String(status)) }}
      back={{
        href: '/dashboard/crm/purchases/expenses',
        label: 'All bills',
      }}
      actions={
        <BillDetailActions
          billId={billId}
          billNo={bill.billNo ?? ''}
          status={status}
          vendorEmail={vendor.email}
        />
      }
      rightRail={
        <>
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

          {/* Vendor chip + outstanding */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Vendor</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-[12.5px]">
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
            </ZoruCardContent>
          </ZoruCard>

          {/* At a glance + inline status / vendor */}
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>At a glance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <BillQuickEdits
                billId={billId}
                status={status}
                vendorId={bill.vendorId}
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
            </ZoruCardContent>
          </ZoruCard>

          {/* Live-poll wrapper — refreshes related counts when a downstream
              doc (payout / debit-note) lands. */}
          <BillRelatedRail billId={billId} initial={related} />

          <ZoruButton size="sm" variant="ghost" asChild className="w-full">
            <Link
              href={`/dashboard/crm/purchases/expenses/${billId}/activity`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </ZoruButton>
        </>
      }
      audit={<EntityAuditTimeline entityKind="bill" entityId={billId} />}
    >
      <p className="text-[12.5px] text-zoru-ink-muted">
        {subtitleParts.join(' · ')}
      </p>

      <BillDetailBody
        bill={bill}
        vendorContact={{ email: vendor.email, phone: vendor.phone }}
      />

      {/* Payment history (payouts applied) */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Payment history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
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
        </ZoruCardContent>
      </ZoruCard>

      {/* Linked PO / GRN cards */}
      {bill.linkedPoId || (bill.linkedGrnIds && bill.linkedGrnIds.length) ? (
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Linked documents</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
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
    </EntityDetailShell>
  );
}
