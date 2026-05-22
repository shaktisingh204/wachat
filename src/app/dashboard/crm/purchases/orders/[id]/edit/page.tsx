/**
 * Edit purchase order — `/dashboard/crm/purchases/orders/[id]/edit`.
 *
 * Hydrates the existing PO and passes it to the shared
 * `<PurchaseOrderForm>` (re-used from the Create flow). The form
 * submits a PATCH because `_id` is rendered as a hidden input.
 *
 * Wrapped in `<EntityDetailShell>` per CRM_PAGE_REDESIGN_PLAN §3.3.2 so
 * the editor sees activity + summary context while editing. The form
 * itself already covers every §3.3.2 pattern (vendor picker, line items,
 * approval workflow, SabFiles attachment, sectioned cards) so this
 * page only adds chrome.
 *
 * Purchase Orders skip the custom-field panel — `'purchaseOrder'` is
 * not a registered `WsCustomFieldBelongsTo` key.
 */

import { notFound } from 'next/navigation';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { PurchaseOrderForm } from '../../_components/purchase-order-form';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(value: unknown, currency?: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? 'INR'} ${value}`;
  }
}

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ order }, session] = await Promise.all([
    getPurchaseOrder(id),
    getSession(),
  ]);

  if (!order) notFound();

  const orderRecord = order as unknown as Record<string, unknown>;
  const total = typeof orderRecord.total === 'number' ? orderRecord.total : 0;
  const currency =
    typeof orderRecord.currency === 'string' ? orderRecord.currency : 'INR';
  const status = typeof orderRecord.status === 'string' ? orderRecord.status : 'draft';
  const vendorName =
    typeof orderRecord.vendorName === 'string' ? orderRecord.vendorName : '';

  return (
    <EntityDetailShell
      eyebrow="PURCHASE ORDER"
      title={`Edit · ${order.poNo || 'purchase order'}`}
      back={{
        href: `/dashboard/crm/purchases/orders/${id}`,
        label: 'Back to purchase order',
      }}
      status={{
        label: status.replace(/_/g, ' '),
        tone:
          status === 'received' || status === 'closed' || status === 'approved'
            ? 'green'
            : status === 'cancelled'
              ? 'red'
              : status === 'awaiting_approval' || status === 'partial'
                ? 'amber'
                : 'neutral',
      }}
      rightRail={
        <>
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Summary</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Vendor</span>
                  <span className="truncate">{vendorName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Date</span>
                  <span>{fmtDate(orderRecord.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zoru-ink-muted">Expected</span>
                  <span>{fmtDate(orderRecord.expectedDelivery)}</span>
                </div>
                <div className="flex justify-between border-t border-zoru-line pt-2">
                  <span className="text-zoru-ink-muted">Total</span>
                  <span className="font-mono tabular-nums">
                    {fmtMoney(total, currency)}
                  </span>
                </div>
              </div>
            </ZoruCardContent>
          </ZoruCard>
        </>
      }
      audit={<EntityAuditTimeline entityKind="purchaseOrder" entityId={id} />}
    >
      <PurchaseOrderForm
        initial={order}
        currentUserId={session?.user?._id ? String(session.user._id) : null}
        redirectTo={`/dashboard/crm/purchases/orders/${id}`}
      />
    </EntityDetailShell>
  );
}
