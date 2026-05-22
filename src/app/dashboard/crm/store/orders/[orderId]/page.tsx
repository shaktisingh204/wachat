import { Card } from '@/components/zoruui';
import { notFound } from 'next/navigation';

/**
 * Store order detail — `/dashboard/crm/store/orders/[orderId]`.
 *
 * Shows order overview + items + status transition controls
 * (mark paid / fulfilled / cancel). Auto-invoice creation on
 * `markOrderPaid` is flagged TODO in the action layer.
 */

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getStoreOrderById } from '@/app/actions/crm-store.actions';
import { OrderTransitions } from './order-transitions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, EntityStatusTone> = {
    pending: 'amber',
    paid: 'green',
    awaiting_fulfillment: 'amber',
    fulfilled: 'blue',
    cancelled: 'red',
    refunded: 'red',
};

function fmtMoney(n: unknown, currency = 'INR'): string {
    const num = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
    if (Number.isNaN(num)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
        }).format(num);
    } catch {
        return `${currency} ${num}`;
    }
}

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string | number | Date);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function Field({
    label,
    children,
    fullWidth,
}: {
    label: string;
    children: React.ReactNode;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'sm:col-span-2' : undefined}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                {label}
            </div>
            <div className="mt-1 text-[13px] text-zoru-ink">{children}</div>
        </div>
    );
}

export default async function StoreOrderDetailPage({
    params,
}: {
    params: Promise<{ orderId: string }>;
}) {
    const { orderId } = await params;
    const order = await getStoreOrderById(orderId);
    if (!order) notFound();

    const orderNo =
        (order.orderNo as string) ?? `Order #${orderId.slice(-6)}`;
    const status = (order.status as string) || 'pending';
    const tone = STATUS_TONE[status] ?? 'neutral';
    const currency = (order.currency as string) || 'INR';
    const totals = (order.totals as Record<string, unknown> | null) ?? {};
    const items = Array.isArray(order.items)
        ? (order.items as Record<string, unknown>[])
        : [];

    return (
        <EntityDetailShell
            title={orderNo}
            eyebrow="STORE ORDER"
            status={{ label: status, tone }}
            back={{
                href: '/dashboard/crm/store/orders',
                label: 'Back to orders',
            }}
            actions={
                <OrderTransitions orderId={orderId} status={status} />
            }
            audit={
                <EntityAuditTimeline
                    entityKind="store_order"
                    entityId={orderId}
                />
            }
        >
            <ZoruCard className="p-6">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Order details
                </h2>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <Field label="Order #">{orderNo}</Field>
                    <Field label="Placed at">
                        {fmtDate(order.createdAt)}
                    </Field>
                    <Field label="Customer name">
                        {(order.customerName as string) || '—'}
                    </Field>
                    <Field label="Customer email">
                        {(order.customerEmail as string) || '—'}
                    </Field>
                    <Field label="Customer phone">
                        {(order.customerPhone as string) || '—'}
                    </Field>
                    <Field label="Currency">{currency}</Field>
                    <Field label="Subtotal">
                        {fmtMoney(totals.subTotal ?? order.subtotal, currency)}
                    </Field>
                    <Field label="Shipping">
                        {fmtMoney(totals.shipping ?? order.shipping, currency)}
                    </Field>
                    <Field label="Tax">
                        {fmtMoney(totals.tax ?? order.tax, currency)}
                    </Field>
                    <Field label="Discount">
                        {fmtMoney(totals.discount ?? order.discount, currency)}
                    </Field>
                    <Field label="Total" fullWidth>
                        <span className="text-[14px] font-medium">
                            {fmtMoney(totals.total ?? order.total, currency)}
                        </span>
                    </Field>
                </div>
            </ZoruCard>

            <ZoruCard className="p-6">
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Line items
                </h2>
                {items.length === 0 ? (
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        No line items recorded.
                    </p>
                ) : (
                    <ul className="divide-y divide-zoru-line">
                        {items.map((item, i) => {
                            const qty = Number(item.qty ?? item.quantity ?? 0);
                            const price = Number(item.price ?? item.rate ?? 0);
                            const total =
                                Number(item.total ?? qty * price) || 0;
                            return (
                                <li
                                    key={i}
                                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]"
                                >
                                    <span className="font-medium text-zoru-ink">
                                        {String(
                                            item.title ?? item.name ?? '—',
                                        )}
                                    </span>
                                    <span className="text-zoru-ink-muted">
                                        {qty} × {fmtMoney(price, currency)} ={' '}
                                        <span className="text-zoru-ink">
                                            {fmtMoney(total, currency)}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </ZoruCard>
        </EntityDetailShell>
    );
}
