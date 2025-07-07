

'use client';

import { CartView } from '@/components/wabasimplify/website-builder/cart-view';
import { Suspense } from 'react';

function CartPageSkeleton() {
    return <div>Loading cart...</div>;
}

export default function CartPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Your Shopping Cart</h1>
            <Suspense fallback={<CartPageSkeleton />}>
                <CartView />
            </Suspense>
        </div>
    );
}

