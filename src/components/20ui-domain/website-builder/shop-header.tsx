'use client';

import { Badge } from '@/components/sabcrm/20ui';
import { useCart } from '@/context/cart-context';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export function ShopHeader({ shopName }: { shopName: string }) {
    const { itemCount } = useCart();
    const params = useParams();

    return (
        <header className="sticky top-0 z-40 w-full border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link
                    href={`/shop/${params.slug}`}
                    className="text-xl font-bold"
                    style={{ color: 'var(--shop-primary-color)' }}
                >
                    {shopName}
                </Link>
                <nav>
                    <Link
                        href={`/shop/${params.slug}/cart`}
                        aria-label={itemCount > 0 ? `View cart, ${itemCount} items` : 'View cart'}
                        className="u-btn u-btn--ghost u-btn--md gap-2"
                    >
                        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                        {itemCount > 0 ? (
                            <Badge tone="accent" kind="solid">
                                {itemCount}
                            </Badge>
                        ) : null}
                    </Link>
                </nav>
            </div>
        </header>
    );
}
