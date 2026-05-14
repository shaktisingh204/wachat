/**
 * Purchase order detail — `/dashboard/crm/purchases/orders/[id]`.
 *
 * Server component per CRM_REBUILD_PLAN §1D.2. Composes:
 *   - Header: status pill (click → status change) + 10+ action buttons.
 *   - Body cards via `<PurchaseOrderDetailBody>`: Overview, Approval
 *     workflow, Vendor, Line items, Money summary. Plus inline cards
 *     for notes, attachments, tags.
 *   - Right rail: LineageRail · Vendor chip + outstanding balance ·
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
          <ZoruButton variant="outline" asChild>
            <Link href="/dashboard/crm/purchases/orders">
              <ArrowLeft className="h-4 w-4" /> Back to Purchase Orders
            </Link>
          </ZoruButton>
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

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/crm/purchases/orders"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Purchase Orders
        </Link>
        <CrmPageHeader
          title={order.poNo || 'Purchase order'}
          subtitle={`Issued ${fmtDate(order.date)} · Expected ${fmtDate(order.expectedDelivery)} · ${fmtMoney(totals.total, currency)}`}
          breadcrumbs={[
            { label: 'CRM', href: '/dashboard/crm' },
            { label: 'Purchases', href: '/dashboard/crm/purchases' },
            {
              label: 'Purchase Orders',
              href: '/dashboard/crm/purchases/orders',
            },
            { label: order.poNo || 'Purchase order' },
          ]}
        />
        <PurchaseOrderDetailActions
          poId={poId}
          poNo={order.poNo ?? ''}
          status={status}
          contactEmail={vendor.email}
          contactPhone={vendor.phone}
        />
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <main className="min-w-0 flex-1 space-y-6">
          <PurchaseOrderDetailBody
            order={order}
            vendor={{
              name: vendor.name,
              email: vendor.email,
              phone: vendor.phone,
            }}
          />

          {/* Notes */}
          {order.notes || order.termsAndConditions ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Notes
              </h2>
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
            </ZoruCard>
          ) : null}

          {/* Tags */}
          {Array.isArray((order as { tags?: string[] }).tags) &&
          (order as { tags?: string[] }).tags!.length > 0 ? (
            <ZoruCard className="p-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {(order as { tags?: string[] }).tags!.map((t) => (
                  <ZoruBadge key={t} variant="outline">
                    {t}
                  </ZoruBadge>
                ))}
              </div>
            </ZoruCard>
          ) : null}
        </main>

        <aside className="w-full md:w-80 md:shrink-0">
          <div className="space-y-4 md:sticky md:top-4">
            <LineageRail
              current={{
                kind: 'purchaseOrder',
                id: poId,
                no: order.poNo,
                status: typeof order.status === 'string' ? order.status : undefined,
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

            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Vendor
              </h3>
              <div className="space-y-2 text-[12.5px]">
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
              </div>
            </ZoruCard>

            <ZoruCard className="p-4">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                At a glance
              </h3>
              <PurchaseOrderQuickEdits
                poId={poId}
                status={status}
                vendorId={order.vendorId}
                buyerId={buyerId}
                approverId={approverId}
              />
              <div className="mt-3 space-y-1.5 text-[12.5px]">
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
            </ZoruCard>

            <PurchaseOrderRelatedRail poId={poId} initial={related} />

            <ZoruButton size="sm" variant="ghost" asChild className="w-full">
              <Link href={`/dashboard/crm/purchases/orders/${poId}/activity`}>
                <ClipboardList className="h-3.5 w-3.5" />
                View full activity log
              </Link>
            </ZoruButton>
          </div>
        </aside>
      </div>

      <EntityAuditTimeline entityKind="purchaseOrder" entityId={poId} />
    </div>
  );
}
