

import { notFound } from 'next/navigation';
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/wabasimplify/website-builder/canvas';
import { CartView } from '@/components/wabasimplify/website-builder/cart-view';
import { CartProvider } from '@/context/cart-context';


export default async function CartPage({ params }: { params: { slug: string }}) {
    const shop = await getEcommShopBySlug(params.slug);
    if (!shop) {
        notFound();
    }
    
    // If the cart page has a custom layout, render it.
    if (shop.cartPageLayout && shop.cartPageLayout.length > 0) {
        return (
            <main>
                <CartProvider>
                    <Canvas
                        layout={shop.cartPageLayout}
                        products={[]}
                        shopSlug={shop.slug}
                        isEditable={false}
                    />
                </CartProvider>
            </main>
        );
    }

    // Fallback to the default, hard-coded cart view.
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Your Shopping Cart</h1>
            <CartProvider>
                <CartView />
            </CartProvider>
        </div>
    );
}
