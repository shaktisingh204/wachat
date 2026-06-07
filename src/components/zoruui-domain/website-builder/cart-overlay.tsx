'use client';

import { useCart } from '@/context/cart-context';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function CartOverlay({ shopSlug }: { shopSlug: string }) {
    const { itemCount } = useCart();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || itemCount === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Link
                href={`/shop/${shopSlug}/cart`}
                aria-label={`View cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                className="relative flex h-16 w-16 items-center justify-center rounded-full text-[var(--st-text-inverted)] shadow-2xl transition-transform duration-150 ease-out hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-2"
                style={{ backgroundColor: 'var(--shop-primary-color)' }}
            >
                <ShoppingCart className="h-6 w-6" aria-hidden="true" />
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--st-bg)] bg-[var(--st-text)] text-xs font-bold text-[var(--st-bg)]">
                    {itemCount}
                </span>
            </Link>
        </div>
    );
}
