'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { getOrCreateCart, updateCartItems, startCheckout } from '@/app/actions/storefront.actions';
import { getStoredCartId, setStoredCartId } from '../_components/add-to-cart-button';

interface CartShape {
    _id: string;
    currency?: string;
    lineItems: Array<{
        productId: string;
        name: string;
        imageUrl?: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
    }>;
    totals: { subtotal: number; tax: number; shipping: number; total: number };
}

const SESSION_KEY = 'sabnode_storefront_session_id';

function getGuestSession(): string {
    if (typeof window === 'undefined') return '';
    let v = window.localStorage.getItem(SESSION_KEY);
    if (!v) {
        v = `g_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(SESSION_KEY, v);
    }
    return v;
}

export default function CartPage(): React.JSX.Element {
    const params = useParams<{ tenantSlug: string }>();
    const router = useRouter();
    const tenantSlug = params.tenantSlug;
    const [cart, setCart] = React.useState<CartShape | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    const load = React.useCallback(async () => {
        const cartId = getStoredCartId() ?? undefined;
        const r = await getOrCreateCart({ tenantSlug, cartId, guestSessionId: getGuestSession() });
        if (r.ok) {
            const c = r.cart as CartShape;
            setStoredCartId(c._id);
            setCart(c);
        }
        setLoading(false);
    }, [tenantSlug]);

    React.useEffect(() => { load(); }, [load]);

    async function setQty(productId: string, qty: number) {
        if (!cart) return;
        const next = cart.lineItems
            .map((li) => (li.productId === productId ? { ...li, quantity: Math.max(0, qty) } : li))
            .filter((li) => li.quantity > 0);
        const r = await updateCartItems(cart._id, next);
        if (r.ok) setCart(r.cart as CartShape);
    }

    async function onCheckout() {
        if (!cart || cart.lineItems.length === 0) return;
        setBusy(true);
        const r = await startCheckout({ tenantSlug, cartId: cart._id });
        setBusy(false);
        if (r.ok) router.push(`/store/${tenantSlug}/checkout/address?co=${r.checkoutId}`);
    }

    if (loading) return <p className="opacity-70">Loading cart…</p>;
    if (!cart || cart.lineItems.length === 0) {
        return (
            <div>
                <h1 className="mb-2 text-2xl font-semibold">Your cart is empty</h1>
                <Link className="storefront-button secondary" href={`/store/${tenantSlug}`}>← Continue shopping</Link>
            </div>
        );
    }

    return (
        <div>
            <h1 className="mb-4 text-2xl font-semibold">Your cart</h1>
            <ul className="divide-y">
                {cart.lineItems.map((li) => (
                    <li key={li.productId} className="flex items-center gap-4 py-4">
                        {li.imageUrl ? (
                            <img src={li.imageUrl} alt={li.name} className="h-16 w-16 rounded-md object-cover" />
                        ) : (
                            <div className="h-16 w-16 rounded-md bg-zoru-surface-2" />
                        )}
                        <div className="flex-1">
                            <div className="font-medium">{li.name}</div>
                            <div className="text-sm opacity-70">{cart.currency ?? '₹'} {li.unitPrice}</div>
                        </div>
                        <input
                            type="number"
                            min={0}
                            value={li.quantity}
                            onChange={(e) => setQty(li.productId, Number(e.target.value))}
                            className="storefront-input w-20"
                        />
                        <div className="w-24 text-right font-medium">{cart.currency ?? '₹'} {li.lineTotal}</div>
                    </li>
                ))}
            </ul>
            <div className="mt-6 flex items-center justify-between">
                <Link className="storefront-button secondary" href={`/store/${tenantSlug}`}>← Keep shopping</Link>
                <div className="text-right">
                    <div className="text-sm opacity-70">Subtotal</div>
                    <div className="text-2xl font-semibold">{cart.currency ?? '₹'} {cart.totals.total}</div>
                    <button onClick={onCheckout} disabled={busy} className="storefront-button mt-3">
                        {busy ? 'Starting…' : 'Checkout'}
                    </button>
                </div>
            </div>
        </div>
    );
}
