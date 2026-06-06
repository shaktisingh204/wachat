'use client';

import { useCart } from '@/context/cart-context';
import { Button } from '@/components/sabcrm/20ui';
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
            <Button asChild size="lg" className="rounded-full h-16 w-16 shadow-2xl relative" style={{ backgroundColor: 'var(--shop-primary-color)', color: 'var(--st-text-inverted)' }}>
                <Link href={`/shop/${shopSlug}/cart`}>
                    <ShoppingCart className="h-6 w-6" />
                    <span className="absolute -top-2 -right-2 bg-[var(--st-text)] text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-background">
                        {itemCount}
                    </span>
                </Link>
            </Button>
        </div>
    );
}
