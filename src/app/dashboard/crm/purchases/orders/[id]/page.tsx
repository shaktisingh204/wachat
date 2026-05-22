import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Badge } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { ArrowLeft,
  ClipboardList } from 'lucide-react';

/**
 * Purchase order detail — `/dashboard/crm/purchases/orders/[id]`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2).
 *
 * Server component. Lifted onto the canonical `<EntityDetailShell>` so
 * the header / body / right-rail / audit-footer composition matches the
 * Invoices template at `/dashboard/crm/sales/invoices/[id]`. Body
 * composition is unchanged (`<PurchaseOrderDetailBody>` already met the
 * §1D.2 bar) — this rebuild only swaps the page chrome.
 *
 * Header: back link + eyebrow + status pill + 9-button action group.
 * Body: overview, vendor, line items, money summary, notes, tags.
 * Right rail: LineageRail (RFQ→bid→PO→GRN→bill→payout) · vendor chip
 * with outstanding · quick-edit chips · related-counts · activity link.
 * Audit footer: <EntityAuditTimeline entityKind="purchaseOrder">.
 */

import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { LineageRail } from '@/components/crm/lineage-rail';
import { statusToTone } from '@/components/crm/status-pill';
import {
  getCrmPurchaseOrderRelatedCounts,
  getPurchaseOrder,
} from '@/app/actions/crm/purchase-orders.actions';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { LineageKind } from '@/lib/definitions';

import { PurchaseOrderDetailActions } from '../_components/purchase-order-detail-actions';
import { PurchaseOrderDetailBody } from '../_components/purchase-order-detail-body';
import { PurchaseOrderPrintView } from '../_components/purchase-order-print-view';
import { PurchaseOrderQuickEdits } from '../_components/purchase-order-quick-edits';
import { PurchaseOrderRelatedRail } from '../_components/purchase-order-related-rail';

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
): Promise<{
  name: string | null;
  email: string | null;
  phone: string | null;
  outstanding: number | null;
}> {
  if (!vendorId || !ObjectId.isValid(vendorId)) {
    return { name: null, email: null, phone: null, outstanding: null };
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
            vendorName: 1,
            email: 1,
            phone: 1,
            outstanding: 1,
            balance: 1,
          },
        },
      );
    const rec = doc as
      | {
          name?: string;
          vendorName?: string;
          email?: string;
          phone?: string;
          outstanding?: number;
          balance?: number;
        }
      | null;
    return {
      name: rec?.name ?? rec?.vendorName ?? null,
      email: rec?.email ?? null,
      phone: rec?.phone ?? null,
      outstanding:
        typeof rec?.outstanding === 'number'
          ? rec.outstanding
          : typeof rec?.balance === 'number'
            ? rec.balance
            : null,
    };
  } catch {
    return { name: null, email: null, phone: null, outstanding: null };
  }
}

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const printMode = sp?.print === '1';

  const session = await getSession();

  const { order, error } = await getPurchaseOrder(id);

  if (!order) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <p className="text-[14px] text-zoru-ink">
            Couldn&apos;t load this purchase order — {error}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/orders">
              <ArrowLeft className="h-4 w-4" /> Back to Purchase Orders
            </Link>
          </Button>
        </div>
      );
    }
    notFound();
  }

  const poId = String(order._id);
  const currency = order.currency || 'INR';
  const status =
    typeof order.status === 'string' ? order.status : 'draft';
  const totals = order.totals ?? { subTotal: 0, total: 0 };

  const userObjectId = session?.user?._id
    ? new ObjectId(String(session.user._id))
    : null;
  // Parallel fan-out — vendor hydration + related counts share zero state,
  // so kick them off together (async-parallel best practice).
  const [vendor, related] = await Promise.all([
    userObjectId
      ? hydrateVendor(order.vendorId, userObjectId)
      : Promise.resolve({
          name: null,
          email: null,
          phone: null,
          outstanding: null,
        }),
    getCrmPurchaseOrderRelatedCounts(poId),
  ]);

  if (printMode) {
    return (
      <PurchaseOrderPrintView
        order={order}
        vendorLabel={vendor.name ?? order.vendorId}
      />
    );
  }

  const buyerId = order.assignment?.assignedTo
    ? String(order.assignment.assignedTo)
    : null;
  const approverId = order.approval?.approvedBy
    ? String(order.approval.approvedBy)
    : order.approval?.requestedBy
      ? String(order.approval.requestedBy)
      : null;

  const title = order.poNo || `Purchase order ${poId.slice(-6)}`;
  const subtitleParts = [
    `Issued ${fmtDate(order.date)}`,
    `Expected ${fmtDate(order.expectedDelivery)}`,
    fmtMoney(totals.total, currency),
  ];

  return (
    <EntityDetailShell
      title={title}
      eyebrow={`PURCHASE ORDER ${order.poNo ?? poId.slice(-6)}`}
      status={{ label: status, tone: statusToTone(status) }}
      back={{
        href: '/dashboard/crm/purchases/orders',
        label: 'All purchase orders',
      }}
      actions={
        <PurchaseOrderDetailActions
          poId={poId}
          poNo={order.poNo ?? ''}
          status={status}
          contactEmail={vendor.email}
          contactPhone={vendor.phone}
        />
      }
      rightRail={
        <>
          <LineageRail
            current={{
              kind: 'purchaseOrder',
              id: poId,
              no: order.poNo,
              status:
                typeof order.status === 'string' ? order.status : undefined,
            }}
            lineage={
              (order.lineage ?? []) as Array<{
                kind: LineageKind;
                id: string;
                no?: string;
                status?: string;
              }>
            }
          />

          {/* Vendor chip + outstanding */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Vendor</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-[12.5px]">
              {order.vendorId ? (
                <EntityPickerChip entity="vendor" id={order.vendorId} />
              ) : (
                <span className="text-zoru-ink-muted">No vendor linked</span>
              )}
              {vendor.outstanding != null ? (
                <div className="flex items-center justify-between gap-2 border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Outstanding</span>
                  <span
                    className={`font-mono tabular-nums ${
                      vendor.outstanding > 0
                        ? 'text-zoru-danger-ink'
                        : 'text-zoru-ink'
                    }`}
                  >
                    {fmtMoney(vendor.outstanding, currency)}
                  </span>
                </div>
              ) : null}
            </ZoruCardContent>
          </Card>

          {/* At a glance + inline status / vendor / buyer / approver */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>At a glance</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <PurchaseOrderQuickEdits
                poId={poId}
                status={status}
                vendorId={order.vendorId}
                buyerId={buyerId}
                approverId={approverId}
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
                    {fmtDate(order.createdAt ?? order.audit?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zoru-ink-muted">Updated</span>
                  <span>
                    {fmtDate(order.updatedAt ?? order.audit?.updatedAt)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          {/* Live-poll wrapper — refreshes related counts when a
              downstream doc (GRN, bill, payout) lands. */}
          <PurchaseOrderRelatedRail poId={poId} initial={related} />

          <Button size="sm" variant="ghost" asChild className="w-full">
            <Link
              href={`/dashboard/crm/purchases/orders/${poId}/activity`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View full activity log
            </Link>
          </Button>
        </>
      }
      audit={
        <EntityAuditTimeline entityKind="purchaseOrder" entityId={poId} />
      }
    >
      {/* Subtitle banner — narrow row below the shell header. */}
      <p className="text-[12.5px] text-zoru-ink-muted">
        {subtitleParts.join(' · ')}
      </p>

      <PurchaseOrderDetailBody
        order={order}
        vendor={{
          name: vendor.name,
          email: vendor.email,
          phone: vendor.phone,
        }}
      />

      {/* Notes (internal + T&C) */}
      {order.notes || order.termsAndConditions ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Notes</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="grid gap-4 md:grid-cols-2 text-[13px]">
              {order.notes ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Internal notes
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
                </div>
              ) : null}
              {order.termsAndConditions ? (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Terms &amp; conditions
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">
                    {order.termsAndConditions}
                  </p>
                </div>
              ) : null}
            </div>
          </ZoruCardContent>
        </Card>
      ) : null}

      {/* Tags */}
      {Array.isArray((order as { tags?: string[] }).tags) &&
      (order as { tags?: string[] }).tags!.length > 0 ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Tags</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="flex flex-wrap gap-2">
              {(order as { tags?: string[] }).tags!.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      ) : null}
    </EntityDetailShell>
  );
}
