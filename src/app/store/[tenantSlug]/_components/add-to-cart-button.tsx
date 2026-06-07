'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { getOrCreateCart, updateCartItems } from '@/app/actions/storefront.actions';
import { Button, Field, Input } from '@/components/sabcrm/20ui';

interface CartShape {
    _id: string;
    lineItems: Array<{
        productId: string;
        name: string;
        imageUrl?: string;
        unitPrice: number;
        quantity: number;
    }>;
}

const SESSION_KEY = 'sabnode_storefront_session_id';
const CART_KEY = 'sabnode_storefront_cart_id';

function getGuestSession(): string {
    if (typeof window === 'undefined') return '';
    let v = window.localStorage.getItem(SESSION_KEY);
    if (!v) {
        v = `g_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(SESSION_KEY, v);
    }
    return v;
}

export function getStoredCartId(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(CART_KEY);
}

export function setStoredCartId(id: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CART_KEY, id);
}

export function AddToCartButton(props: {
    tenantSlug: string;
    productId: string;
    name: string;
    unitPrice: number;
    imageUrl?: string;
}): React.JSX.Element {
    const router = useRouter();
    const [busy, setBusy] = React.useState(false);
    const [quantity, setQuantity] = React.useState(1);

    async function onAdd() {
        setBusy(true);
        const guestSessionId = getGuestSession();
        const cartId = getStoredCartId() ?? undefined;
        const cartRes = await getOrCreateCart({
            tenantSlug: props.tenantSlug,
            cartId,
            guestSessionId,
        });
        if (!cartRes.ok) { setBusy(false); return; }
        const cart = cartRes.cart as CartShape;
        setStoredCartId(cart._id);
        const existing = cart.lineItems ?? [];
        const idx = existing.findIndex((li) => li.productId === props.productId);
        const nextItems = [...existing];
        if (idx >= 0) {
            nextItems[idx] = { ...nextItems[idx], quantity: nextItems[idx].quantity + quantity };
        } else {
            nextItems.push({
                productId: props.productId,
                name: props.name,
                imageUrl: props.imageUrl,
                unitPrice: props.unitPrice,
                quantity,
            });
        }
        await updateCartItems(cart._id, nextItems);
        setBusy(false);
        router.push(`/store/${props.tenantSlug}/cart`);
    }

    return (
        <div className="flex items-end gap-2">
            <Field label="Qty" className="w-20">
                <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                />
            </Field>
            <Button variant="primary" onClick={onAdd} loading={busy} disabled={busy}>
                {busy ? 'Adding' : 'Add to cart'}
            </Button>
        </div>
    );
}
