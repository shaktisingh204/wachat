
'use client';

import { CheckoutForm } from '@/components/wabasimplify/website-builder/checkout-form';
import { Suspense } from 'react';
import { CartProvider } from '@/context/cart-context';

function CheckoutPageSkeleton() {
    return <div>Loading checkout...</div>;
}

export default function CheckoutPage() {
    return (
        <CartProvider>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                 <Suspense fallback={<CheckoutPageSkeleton />}>
                    <CheckoutForm />
                </Suspense>
            </div>
        </CartProvider>
    );
}
