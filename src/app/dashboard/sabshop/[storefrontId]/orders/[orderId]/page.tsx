'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import {
    Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle,
    Badge, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue,
    useZoruToast,
} from '@/components/zoruui';

import { getOrder, updateOrder } from '@/app/actions/sabshop.actions';

interface OrderShape {
    _id: string;
    orderCode: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    totals?: { subtotal?: number; tax?: number; shipping?: number; total?: number };
    currency?: string;
    lineItems?: Array<{ name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    shippingAddress?: Record<string, string>;
    paymentRef?: string;
}

export default function OrderDetailPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string; orderId: string }>();
    const { toast } = useZoruToast();
    const [order, setOrder] = React.useState<OrderShape | null>(null);
    const [loading, setLoading] = React.useState(true);

    const load = React.useCallback(async () => {
        const r = await getOrder(params.orderId);
        if (r.ok) setOrder(r.item as OrderShape);
        setLoading(false);
    }, [params.orderId]);

    React.useEffect(() => { load(); }, [load]);

    if (loading) return <div className="zoruui p-6 text-zoru-ink-muted">Loading…</div>;
    if (!order) return <div className="zoruui p-6 text-red-500">Order not found.</div>;

    async function setStatus(field: 'paymentStatus' | 'fulfillmentStatus', value: string) {
        const r = await updateOrder(params.orderId, { [field]: value });
        if (r.ok) { toast({ title: 'Order updated' }); load(); }
        else toast({ title: r.error, variant: 'destructive' });
    }

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">Order</p>
                    <h1 className="text-2xl font-semibold text-zoru-ink">{order.orderCode}</h1>
                </div>
                <div className="flex gap-2">
                    <Badge variant={order.paymentStatus === 'paid' ? 'success' : 'warning'}>{order.paymentStatus}</Badge>
                    <Badge variant="ghost">{order.fulfillmentStatus}</Badge>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <ZoruCardHeader><ZoruCardTitle>Line items</ZoruCardTitle></ZoruCardHeader>
                    <ZoruCardContent>
                        <ul className="divide-y divide-zoru-border">
                            {(order.lineItems ?? []).map((li, i) => (
                                <li key={i} className="flex items-center justify-between py-2 text-sm">
                                    <div>
                                        <div className="font-medium text-zoru-ink">{li.name}</div>
                                        <div className="text-xs text-zoru-ink-muted">{li.quantity} × {li.unitPrice}</div>
                                    </div>
                                    <div className="font-medium">{order.currency ?? '₹'} {li.lineTotal}</div>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-zoru-ink-muted">Subtotal</span><span>{order.totals?.subtotal ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-zoru-ink-muted">Tax</span><span>{order.totals?.tax ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-zoru-ink-muted">Shipping</span><span>{order.totals?.shipping ?? 0}</span></div>
                            <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{order.currency ?? '₹'} {order.totals?.total ?? 0}</span></div>
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader><ZoruCardTitle>Actions</ZoruCardTitle></ZoruCardHeader>
                    <ZoruCardContent className="flex flex-col gap-3 text-sm">
                        <div>
                            <p className="mb-1 text-zoru-ink-muted">Payment status</p>
                            <Select value={order.paymentStatus} onValueChange={(v) => setStatus('paymentStatus', v)}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="unpaid">Unpaid</ZoruSelectItem>
                                    <ZoruSelectItem value="paid">Paid</ZoruSelectItem>
                                    <ZoruSelectItem value="refunded">Refunded</ZoruSelectItem>
                                    <ZoruSelectItem value="failed">Failed</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div>
                            <p className="mb-1 text-zoru-ink-muted">Fulfillment</p>
                            <Select value={order.fulfillmentStatus} onValueChange={(v) => setStatus('fulfillmentStatus', v)}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="unfulfilled">Unfulfilled</ZoruSelectItem>
                                    <ZoruSelectItem value="processing">Processing</ZoruSelectItem>
                                    <ZoruSelectItem value="shipped">Shipped</ZoruSelectItem>
                                    <ZoruSelectItem value="delivered">Delivered</ZoruSelectItem>
                                    <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        {order.shippingAddress && (
                            <div className="space-y-1">
                                <p className="text-zoru-ink-muted">Ship to</p>
                                <p>{order.shippingAddress.name}</p>
                                <p>{order.shippingAddress.line1}</p>
                                <p>{order.shippingAddress.city} {order.shippingAddress.postalCode}</p>
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
