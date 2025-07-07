

'use client';

import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export function ShopHeader({ shopName }: { shopName: string }) {
    const { itemCount } = useCart();
    const params = useParams();
    
    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link href={`/shop/${params.slug}`} className="text-xl font-bold" style={{ color: 'var(--shop-primary-color)' }}>
                    {shopName}
                </Link>
                <nav>
                    <Button asChild variant="ghost">
                        <Link href={`/shop/${params.slug}/cart`}>
                            <ShoppingCart className="h-5 w-5" />
                            {itemCount > 0 && (
                                <span className="ml-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                    {itemCount}
                                </span>
                            )}
                        </Link>
                    </Button>
                </nav>
            </div>
        </header>
    );
}

