'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
    Card, ZoruCardContent, Badge,
    Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow,
} from '@/components/zoruui';

import { listOrders } from '@/app/actions/sabshop.actions';

interface OrderRow {
    _id: string;
    orderCode: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    totals?: { total?: number };
    currency?: string;
    createdAt?: string;
}

export default function OrdersPage(): React.JSX.Element {
    const params = useParams<{ storefrontId: string }>();
    const id = params.storefrontId;
    const [items, setItems] = React.useState<OrderRow[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        (async () => {
            const r = await listOrders(id);
            if (r.ok) setItems(r.items as OrderRow[]);
            setLoading(false);
        })();
    }, [id]);

    return (
        <div className="zoruui flex flex-col gap-4 p-6">
            <h1 className="text-2xl font-semibold text-zoru-ink">Orders</h1>
            <Card>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-6 text-sm text-zoru-ink-muted">Loading…</div>
                    ) : items.length === 0 ? (
                        <div className="p-6 text-sm text-zoru-ink-muted">No orders yet.</div>
                    ) : (
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Order</ZoruTableHead>
                                    <ZoruTableHead>Total</ZoruTableHead>
                                    <ZoruTableHead>Payment</ZoruTableHead>
                                    <ZoruTableHead>Fulfillment</ZoruTableHead>
                                    <ZoruTableHead>Placed</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {items.map((o) => (
                                    <ZoruTableRow key={o._id}>
                                        <ZoruTableCell>
                                            <Link
                                                href={`/dashboard/sabshop/${id}/orders/${o._id}`}
                                                className="font-medium text-zoru-ink hover:underline"
                                            >
                                                {o.orderCode}
                                            </Link>
                                        </ZoruTableCell>
                                        <ZoruTableCell>{o.currency ?? '₹'} {o.totals?.total?.toFixed?.(2) ?? '0.00'}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant={o.paymentStatus === 'paid' ? 'success' : 'warning'}>
                                                {o.paymentStatus}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant="ghost">{o.fulfillmentStatus}</Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink-muted">
                                            {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
