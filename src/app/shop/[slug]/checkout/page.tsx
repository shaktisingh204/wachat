import { Suspense } from 'react';
import { CartProvider } from '@/context/cart-context';
import { CheckoutContent } from './components/checkout-content';
import { CheckoutPageSkeleton } from './components/skeletons';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;

    return (
        <CartProvider>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                 <Suspense fallback={<CheckoutPageSkeleton />}>
                    <CheckoutContent slug={params.slug} />
                </Suspense>
            </div>
        </CartProvider>
    );
}
