import { notFound } from 'next/navigation';
import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { Canvas } from '@/components/zoruui-domain/website-builder/canvas';
import { CartView } from '@/components/zoruui-domain/website-builder/cart-view';
import { CartProvider } from '@/context/cart-context';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

async function CartContent({ slug }: { slug: string }) {
    const shop = await getEcommShopBySlug(slug);
    if (!shop) {
        notFound();
    }

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

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Your Shopping Cart</h1>
            <CartProvider>
                <CartView />
            </CartProvider>
        </div>
    );
}

export default async function CartPage(props: { params: Promise<{ slug: string }>}) {
    const params = await props.params;
    
    return (
        <Suspense fallback={<div className="container mx-auto px-4 py-8"><h1 className="text-3xl font-bold mb-6">Your Shopping Cart</h1><div className="animate-pulse space-y-4"><div className="h-20 bg-muted rounded-md"></div><div className="h-20 bg-muted rounded-md"></div></div></div>}>
            <CartContent slug={params.slug} />
        </Suspense>
    );
}
