'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

import { getOrderByCode } from '@/app/actions/storefront.actions';

interface OrderShape {
    orderCode: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    totals?: { total?: number };
    currency?: string;
    lineItems?: Array<{ name: string; quantity: number; lineTotal: number }>;
}

export default function GuestOrdersPage(): React.JSX.Element {
    const params = useParams<{ tenantSlug: string }>();
    const tenantSlug = params.tenantSlug;
    const [code, setCode] = React.useState('');
    const [order, setOrder] = React.useState<OrderShape | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    async function lookup(e: React.FormEvent) {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        setError(null);
        const r = await getOrderByCode(tenantSlug, code.trim().toUpperCase());
        setBusy(false);
        if (r.ok) setOrder(r.order as OrderShape);
        else { setOrder(null); setError(r.error); }
    }

    return (
        <div className="max-w-xl">
            <h1 className="mb-4 text-2xl font-semibold">Track an order</h1>
            <form onSubmit={lookup} className="flex gap-2">
                <input
                    className="storefront-input"
                    placeholder="Order code (e.g. CO-20260527-12345)"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                />
                <button type="submit" disabled={busy} className="storefront-button">
                    {busy ? '…' : 'Look up'}
                </button>
            </form>
            {error && <p className="mt-3 text-sm text-[var(--st-text)]">{error}</p>}
            {order && (
                <div className="mt-6 rounded-xl border p-4">
                    <h2 className="text-lg font-semibold">{order.orderCode}</h2>
                    <p className="text-sm opacity-70">
                        Payment: {order.paymentStatus} · Fulfillment: {order.fulfillmentStatus}
                    </p>
                    <ul className="mt-3 divide-y">
                        {(order.lineItems ?? []).map((li, i) => (
                            <li key={i} className="flex items-center justify-between py-2 text-sm">
                                <span>{li.name} × {li.quantity}</span>
                                <span>{order.currency ?? '₹'} {li.lineTotal}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-right font-semibold">
                        Total: {order.currency ?? '₹'} {order.totals?.total ?? 0}
                    </p>
                </div>
            )}
        </div>
    );
}
